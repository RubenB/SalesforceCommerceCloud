'use strict';

const Resource = require('dw/web/Resource');
const Transaction = require('dw/system/Transaction');
const OrderMgr = require('dw/order/OrderMgr');
const PaymentMgr = require('dw/order/PaymentMgr');
const Logger = require('*/cartridge/scripts/utils/logger');
const paymentService = require('*/cartridge/scripts/payment/paymentService');
const collections = require('*/cartridge/scripts/util/collections');
const config = require('*/cartridge/scripts/mollieConfig');

/**
 * Creates the payment instrument based on the given information.
 *
 * @param {dw.order.Basket} basket - The basket
 * @param {Object} paymentInformation - The payment form
 * @return {Object} returns an error object
 */
function Handle(basket, paymentInformation) {
    var currentBasket = basket;
    var cardErrors = {};
    var serverErrors = [];

    var pm = paymentInformation.paymentMethod;

    // Removes all Mollie paymentInstruments related to the currentBasket
    // in order to start an order with a clean slate
    Transaction.wrap(function () {
        var paymentInstruments = currentBasket.getPaymentInstruments();

        collections.forEach(paymentInstruments, (function (item) {
            var paymentMethod = PaymentMgr.getPaymentMethod(item.getPaymentMethod());
            if (paymentMethod && paymentMethod.getPaymentProcessor().getID().indexOf('MOLLIE') >= 0) {
                currentBasket.removePaymentInstrument(item);
            }
        }));

        currentBasket.createPaymentInstrument(pm, currentBasket.totalGrossPrice);
    });

    // Payment forms are managed by Mollie, so field and server errors are irrelevant her.
    return { fieldErrors: [cardErrors], serverErrors: serverErrors, error: false };
}

/**
 * Authorizes a payment using an e-commerce redirect.
 *
 * @param {string} orderNumber - The current order's number
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor
 *  -  The payment processor of the current payment method
 * @return {Object} returns an error object
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var serverErrors = [];
    var fieldErrors = {};
    var error = false;
    var redirectUrl;
    try {
        Transaction.wrap(function () {
            paymentInstrument.getPaymentTransaction().setTransactionID(orderNumber);
            paymentInstrument.getPaymentTransaction().setPaymentProcessor(paymentProcessor);
        });

        var order = OrderMgr.getOrder(orderNumber);
        var paymentMethod = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod());
        var issuer = session.forms.billing.issuer.value;

        if (config.getEnabledTransactionAPI() === config.getTransactionAPI().PAYMENT) {
            var result = paymentService.createPayment(order, paymentMethod, { issuer: issuer });
            redirectUrl = result.payment.links.checkout.href;
        } else {
            var result = paymentService.createOrder(order, paymentMethod, { issuer: issuer });
            redirectUrl = result.order.links.checkout.href;
        }
    } catch (e) {
        Logger.error(e.javaMessage + '\n\r' + e.stack);

        error = true;
        serverErrors.push(
            Resource.msg('error.technical', 'checkout', null)
        );
    }

    return {
        redirectUrl: redirectUrl,
        fieldErrors: fieldErrors,
        serverErrors: serverErrors,
        error: error
    };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
