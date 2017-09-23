Meteor.methods({

    ensureAdjCloseExistsFor: function (yyyy_mm_dd) {
        let _qry = {dateString: yyyy_mm_dd, adjClose: {$exists: false}};
        let _prices = NewStockPrices.find(_qry, {fields: {_id: 1, symbol: 1}}).fetch();
        let _symbols = _.pluck(_prices, "symbol");

        Email.send({
            to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
            from: Settings.findOne().serverSettings.ratingsChanges.emailTo,
            subject: "START -- ensureAdjCloseExistsFor",
            text: JSON.stringify({
                timeNow: new Date(),
                nycDate: yyyy_mm_dd,
                missingAdjCloseNum: _prices.length,
                symbols: _symbols
            })
        });

        Meteor.call("fixMissingPricesFor", _symbols);

        let _newPrices = NewStockPrices.find(_qry, {fields: {_id: 1, symbol: 1}}).fetch();

        Email.send({
            to: Settings.findOne().serverSettings.ratingsChanges.emailTo,
            from: Settings.findOne().serverSettings.ratingsChanges.emailTo,
            subject: "FINISH -- ensureAdjCloseExistsFor",
            text: JSON.stringify({
                timeNow: new Date(),
                nycDate: yyyy_mm_dd,
                missingAdjCloseNum: _newPrices.length,
                symbols: _.pluck(_newPrices, "symbol")
            })
        });
    },

});