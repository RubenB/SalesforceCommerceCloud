'use strict';

var Checkout = module.superModule;

var server = require('server');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var URLUtils = require('dw/web/URLUtils');
var AccountModel = require('*/cartridge/models/account');
var BasketMgr = require('dw/order/BasketMgr');
var Locale = require('dw/util/Locale');
var OrderModel = require('*/cartridge/models/order');
var Transaction = require('dw/system/Transaction');

server.extend(Checkout);

/**
 * Checkout-Begin : The Checkout-Begin endpoint will render the checkout shipping page for both guest shopper and returning shopper
 * @name Mollie/Checkout-Begin
 * @function
 * @memberof Checkout
 * @param {renders} - isml
 * @param {serverfunction} - prepend
 */
server.prepend('Begin', function (req, res, next) {
    // in case of a user pressing back button, get the orderId from the privacyCache
    var orderId = req.querystring.orderId || req.session.privacyCache.get('orderId');
    if (orderId && !COHelpers.orderExists(orderId)) {
        res.redirect(URLUtils.home().toString());
    } else {
        COHelpers.restoreOpenOrder(orderId);
    }

    next();
});

/**
 * Checkout-Begin : The Checkout-Begin endpoint will render the checkout shipping page for both guest shopper and returning shopper
 * @name Mollie/Checkout-Begin
 * @function
 * @memberof Checkout
 * @param {renders} - isml
 * @param {serverfunction} - append
 */
server.append('Begin', function (req, res, next) {
    var viewData = res.getViewData();
    var profile = req.currentCustomer.raw.profile;
    viewData.mollie = COHelpers.getMollieViewData(profile);

    next();
});

/**
 * Checkout-UpdatePaymentMethods : The Checkout-UpdatePaymentMethods endpoint will render the checkout payment options
 * @name Mollie/Checkout-UpdatePaymentMethods
 * @function
 * @memberof Checkout
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.post('UpdatePaymentMethods', function (req, res, next) {
    var currentBasket = BasketMgr.getCurrentBasket();
    var currentCustomer = req.currentCustomer;
    var billingAddress = currentBasket.billingAddress;
    var billingForm = server.forms.getForm('billing');

    Transaction.wrap(function () {
        if (!billingAddress) {
            billingAddress = currentBasket.createBillingAddress();
        }

        billingAddress.setCountryCode(billingForm.addressFields.country.value);
    });

    var accountModel = new AccountModel(currentCustomer);
    var orderModel = new OrderModel(currentBasket, { countryCode: Locale.getLocale(req.locale.id).country });
    res.json({
        paymentOptionsTemplate: COHelpers.getPaymentOptionsTemplate(currentBasket, accountModel, orderModel)
    });
    next();
});

module.exports = server.exports();
