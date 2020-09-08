var HookMgr = require('dw/system/HookMgr');
var ISML = require('dw/template/ISML');
var OrderMgr = require('dw/order/OrderMgr');
var Logger = require('*/cartridge/scripts/utils/logger');
var orderHelper = require('*/cartridge/scripts/order/orderHelper');
var paymentService = require('*/cartridge/scripts/payment/paymentService');
var ServiceException = require('*/cartridge/scripts/exceptions/ServiceException');
var PaymentMgr = require('dw/order/PaymentMgr');

var renderTemplate = function (templateName, viewParams) {
    try {
        ISML.renderTemplate(templateName, viewParams);
    } catch (e) {
        Logger.error('Error while rendering template ' + templateName);
        throw e;
    }
};

var sendPaymentLink = function (email, paymentLink) {
    var hookName = 'mollie.send.payment.link';

    if (!HookMgr.hasHook(hookName)) throw new ServiceException('Hook ' + hookName + ' not supported.');

    return HookMgr.callHook(
        hookName,
        'sendPaymentLink',
        email,
        paymentLink
    );
};

exports.Start = function () {
    const orderNo = request.httpParameterMap.get('order_no').stringValue;
    var order = OrderMgr.getOrder(orderNo);
    var paymentLink;
    if (orderHelper.isMollieOrder(order)) {
        var getOrderResult = paymentService.getOrder(orderHelper.getOrderId(order));
        paymentLink = getOrderResult.order.links.checkout.href;
    } else {
        var mollieInstruments = orderHelper.getMolliePaymentInstruments(order);
        var lastMollieInstrument = mollieInstruments.pop();
        var paymentMethodId = lastMollieInstrument.getPaymentMethod();
        var getPaymentResult = paymentService.getPayment(orderHelper.getPaymentId(order, paymentMethodId));
        if (getPaymentResult.payment.checkout.href) {
            paymentLink = getPaymentResult.payment.checkout.href;
        } else {
            var paymentMethod = PaymentMgr.getPaymentMethod(paymentMethodId);
            var createPaymentresult = paymentService.createPayment(order, paymentMethod);
            paymentLink = createPaymentresult.payment.checkout.href;
        }
    }
    if (paymentLink) {
        renderTemplate('order/payment/link/order_payment_link_send.isml', {
            paymentLink: paymentLink,
            orderId: orderNo,
            email: order.customer.profile.email
        });
    } else {
        renderTemplate('order/payment/link/order_payment_link_not_available.isml');
    }
};

exports.SendMail = function () {
    const paymentLink = request.httpParameterMap.get('paymentLink').stringValue;
    const orderId = request.httpParameterMap.get('orderId').stringValue;
    const email = request.httpParameterMap.get('email').stringValue;
    const viewParams = {
        success: true,
        orderId: orderId
    };

    try {
        sendPaymentLink(email, paymentLink);
        Logger.debug('PAYMENT :: Sending link ' + paymentLink + ' for order: ' + orderId + '.');
    } catch (e) {
        Logger.error('PAYMENT :: ERROR :: Error while sending link: ' + paymentLink + ' for order: ' + orderId + '.' + e.message);
        viewParams.success = false;
        viewParams.errorMessage = e.message;
    }

    renderTemplate('order/payment/shipment/order_payment_shipment_confirmation.isml', viewParams);
};

exports.Start.public = true;
exports.SendMail.public = true;
