var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Logger = require('*/cartridge/scripts/utils/logger');
var orderHelper = require('*/cartridge/scripts/order/orderHelper');
var paymentService = require('*/cartridge/scripts/payment/paymentService');
var renderTemplate = require('*/cartridge/scripts/helpers/renderTemplateHelper').renderTemplate;

var isRefundAllowed = function (order) {
    if (!order) return false;
    const orderStatus = order.status.value;
    return (orderStatus !== Order.ORDER_STATUS_CANCELLED &&
        orderStatus !== Order.ORDER_STATUS_FAILED);
};

exports.Start = function () {
    const orderNo = request.httpParameterMap.get('order_no').stringValue;
    var order = OrderMgr.getOrder(orderNo);
    if (!isRefundAllowed(order)) {
        renderTemplate('order/payment/refund/order_payment_refund_not_available.isml');
    } else if (orderHelper.isMollieOrder(order)) {
        var result = paymentService.getOrder(orderHelper.getOrderId(order));
        renderTemplate('order/payment/refund/order_payment_refund_order.isml', {
            orderId: order.orderNo,
            order: result.order
        });
    } else {
        var mollieInstruments = orderHelper.getMolliePaymentInstruments(order);
        var payments = mollieInstruments.map(function (instrument) {
            var paymentMethodId = instrument.getPaymentMethod();
            var paymentId = orderHelper.getPaymentId(order, paymentMethodId);
            return paymentService.getPayment(paymentId).payment;
        });
        if (payments.length) {
            renderTemplate('order/payment/refund/order_payment_refund_payment.isml', {
                orderId: order.orderNo,
                payments: payments
            });
        } else {
            renderTemplate('order/payment/cancel/order_payment_refund_not_available.isml');
        }
    }
};

exports.RefundPayment = function () {
    const orderId = request.httpParameterMap.get('orderId').stringValue;
    const paymentId = request.httpParameterMap.get('paymentId').stringValue;
    const amount = request.httpParameterMap.get('amount').stringValue;
    const currency = request.httpParameterMap.get('currency').stringValue;
    const viewParams = {
        success: true,
        orderId: orderId
    };

    try {
        paymentService.createPaymentRefund(paymentId, {
            value: amount,
            currency: currency
        });
        Logger.debug('PAYMENT :: Payment processed for order ' + orderId);
    } catch (e) {
        Logger.error('PAYMENT :: ERROR :: Error while creating refund for order ' + orderId + '. ' + e.message);
        viewParams.success = false;
        viewParams.errorMessage = e.message;
    }

    renderTemplate('order/payment/refund/order_payment_refund_confirmation.isml', viewParams);
};

exports.RefundOrder = function () {
    const orderId = request.httpParameterMap.get('orderId').stringValue;
    const lineId = request.httpParameterMap.get('lineId').stringValue;
    const quantity = request.httpParameterMap.get('quantity').stringValue;
    const order = OrderMgr.getOrder(orderId);
    const viewParams = {
        success: true,
        orderId: orderId
    };

    try {
        var lines;
        if (quantity && lineId) {
            lines = [{
                id: lineId,
                quantity: quantity
            }];
        }
        paymentService.createOrderRefund(order, lines);
        Logger.debug('PAYMENT :: Payment processed for order ' + orderId);
    } catch (e) {
        Logger.error('PAYMENT :: ERROR :: Error while creating refund for order ' + orderId + '. ' + e.message);
        viewParams.success = false;
        viewParams.errorMessage = e.message;
    }

    renderTemplate('order/payment/refund/order_payment_refund_confirmation.isml', viewParams);
};

exports.Start.public = true;
exports.RefundPayment.public = true;
exports.RefundOrder.public = true;
