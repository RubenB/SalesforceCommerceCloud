'use strict';

var components = require('./components');

/**
 * Init billing functions
 */
function init() {
    onBillingCountryChange();
}

/**
 * Updates the payment information in checkout, based on the supplied order model
 * @param {Object} order - checkout model to use as basis of new truth
 */
function updatePaymentInformation(order) {
    // update payment details
    var $paymentSummary = $('.payment-details');
    var htmlToAppend = '';

    if (order.billing.payment && order.billing.payment.selectedPaymentInstruments &&
        order.billing.payment.selectedPaymentInstruments.length > 0) {
        htmlToAppend += '<span>' +
            order.billing.payment.selectedPaymentInstruments[0].paymentMethod +
            '</span>';
    }

    $paymentSummary.empty().append(htmlToAppend);
}


/**
 * Handles billing country change
 */
function onBillingCountryChange() {
    $(document).on('change', '.billingCountry, #billingAddressSelector', function () {
        var billingAddressForm = $('#dwfrm_billing .billing-address-block :input').serialize();
        $('body').trigger('checkout:disableButton', '.next-step-button button');
        $.ajax({
            url: $('.js-payment-options').attr('data-method-url'),
            method: 'POST',
            data: billingAddressForm,
            success: function (data) {
                $('body').trigger('checkout:enableButton', '.next-step-button button');
                updatePaymentInformation(data);
            },
            error: function () {
                $('body').trigger('checkout:enableButton', '.next-step-button button');
            }
        });
    });
}

/**
 * Updates the payment options based on the supplied rendered template response
 * @param {Object} data - data returned from controller
 */
function updatePaymentOptions(data) {
    if (data.paymentOptionsTemplate) {
        $('.js-payment-options').replaceWith(data.paymentOptionsTemplate);
        components.init();
    }
};

module.exports = {
    init: init,
    updatePaymentOptions: updatePaymentOptions,
    methods: {
        updatePaymentInformation: updatePaymentInformation
    }
};
