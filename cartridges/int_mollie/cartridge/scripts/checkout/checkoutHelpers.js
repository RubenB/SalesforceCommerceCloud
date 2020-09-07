var HookMgr = require('dw/system/HookMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var BasketMgr = require('dw/order/BasketMgr');
var OrderMgr = require('dw/order/OrderMgr');
var URLUtils = require('dw/web/URLUtils');
var Transaction = require('dw/system/Transaction');
var Order = require('dw/order/Order');
var ServiceException = require('*/cartridge/scripts/exceptions/ServiceException');
var Logger = require('*/cartridge/scripts/utils/logger');
var orderHelper = require('*/cartridge/scripts/order/orderHelper');
var config = require('*/cartridge/scripts/mollieConfig');
var renderTemplateHelper = require('*/cartridge/scripts/renderTemplateHelper');

// Require and extend
var COHelpers = require('*/cartridge/scripts/utils/superModule')(module);

/**
 * handles the payment authorization for each payment instrument
 * @param {dw.order.Order} order - the order object
 * @param {string} orderNumber - The order number for the order
 * @returns {Object} an error object
 */
COHelpers.handlePayments = function (order, orderNumber) {
    try {
        if (order.totalNetPrice.getValue() === 0) throw new ServiceException('Order has netPrice of 0');

        var paymentInstruments = order.getPaymentInstruments();

        if (paymentInstruments.length === 0) throw new ServiceException('No paymentInstruments provided');

        // DO NOT DO ANYTHING WITH OTHER PAYMENT INSTRUMENTS AT THE MOMENT
        const mollieInstruments = orderHelper.getMolliePaymentInstruments(order);

        if (mollieInstruments.length !== 1) throw new ServiceException('Expected exactly 1 Mollie Payment Instrument');

        var paymentInstrument = mollieInstruments.pop();
        var paymentMethodID = paymentInstrument.getPaymentMethod();
        var paymentProcessor = PaymentMgr.getPaymentMethod(paymentMethodID).getPaymentProcessor();
        var hookName = 'app.payment.processor.' + paymentProcessor.getID().toLowerCase();

        if (!HookMgr.hasHook(hookName)) throw new ServiceException('Hook ' + hookName + ' not supported.');

        const authorizationResult = HookMgr.callHook(
            hookName,
            'Authorize',
            orderNumber,
            paymentInstrument,
            paymentProcessor
        );

        if (authorizationResult.error) throw new ServiceException('Authorization hook failed');

        return authorizationResult;
    } catch (e) {
        Logger.debug('PAYMENT :: ERROR :: ' + e.message);
        Transaction.wrap(function () { OrderMgr.failOrder(order); });
        if (e.name === 'ServiceException') return { continueUrl: URLUtils.url('Checkout-Begin').toString() };
        return { error: true };
    }
}

/**
 *
 *
 * @param {orderNumber} orderNumber - Order Id
 * @returns {boolean} Order exists?
 */
COHelpers.orderExists = function (orderNumber) {
    return OrderMgr.getOrder(orderNumber) !== null;
}

/**
 * Restores a basket based on the last created order that has not been paid.
 * @param {string} lastOrderNumber - orderId of last order in session
 * @returns {void}
 */
COHelpers.restoreOpenOrder = function (lastOrderNumber) {
    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket || currentBasket.getProductLineItems().length === 0) {
        if (lastOrderNumber) {
            var order = OrderMgr.getOrder(lastOrderNumber);
            if (order && Number(order.getStatus()) === Order.ORDER_STATUS_CREATED) {
                Transaction.wrap(function () {
                    OrderMgr.failOrder(order);
                });
            }
        }
    }
}

/**
 * Attempts to place order and fails order if attempt fails
 * @param {dw.order.Order} order - The order object to be placed
 * @returns {void}
 */
COHelpers.placeOrder = function placeOrder(order) {
    try {
        var orderStatus = order.getStatus() + '';

        if (orderStatus === Order.ORDER_STATUS_CREATED + '' || orderStatus === Order.ORDER_STATUS_FAILED + '') {

            if (orderStatus === Order.ORDER_STATUS_FAILED + '') {
                Transaction.begin();
                var undoFailOrderStatus = OrderMgr.undoFailOrder(order);
                if (undoFailOrderStatus.isError()) {
                    throw new Error(undoFailOrderStatus.message);
                }
                Transaction.commit();
            }

            Transaction.begin();
            var placeOrderStatus = OrderMgr.placeOrder(order);

            if (placeOrderStatus.isError()) {
                throw new Error(placeOrderStatus.message);
            }

            order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
            order.setExportStatus(Order.EXPORT_STATUS_READY);
            Transaction.commit();
        }

    } catch (e) {
        OrderMgr.failOrder(order);
        const errorMessage = 'PAYMENT :: Failed placing the order :: ' + JSON.stringify(e.message);
        orderHelper.addItemToOrderHistory(order, errorMessage, true);
        Transaction.commit();
        throw new ServiceException(errorMessage);
    }
};


/**
 * Returns mollie viewdata
 * @param {dw.customer.Profile} profile - Customer Profile object
 * @returns {object}
 */
COHelpers.getMollieViewData = function (profile) {
    return {
        customerId: profile && profile.custom.mollieCustomerId,
        enableSingleClickPayments: config.getEnableSingleClickPayments(),
        mollieComponents: {
            enabled: config.getComponentsEnabled(),
            profileId: config.getComponentsProfileId(),
            enableTestMode: config.getComponentsEnableTestMode()
        }
    }
}

/**
 * Returns mollie viewdata
 * @param {dw.customer.Profile} profile - Customer Profile object
 * @returns {object}
 */
COHelpers.getPaymentOptionsTemplate = function (currentBasket, accountModel, orderModel) {
    return renderTemplateHelper.getRenderedHtml({
        customer: accountModel,
        order: orderModel,
        forms: {
            billingForm: COHelpers.prepareBillingForm(currentBasket)
        },
        mollie: COHelpers.getMollieViewData(currentBasket.customer.profile)
    }, 'checkout/billing/paymentOptions');
}

module.exports = COHelpers;
