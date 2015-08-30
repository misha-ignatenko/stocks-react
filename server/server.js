Meteor.methods({
    getFullQuote: function (symbol) {
        var _fullQuote = YahooFinance.snapshot({symbols: [symbol]});
        return _fullQuote;
    },
    getLatestAskPrice: function (symbol) {
        var _latestPriceQuote = YahooFinance.snapshot({symbols: [symbol], fields: ['s', 'n', 'd1', 'l1', 'y', 'r']});
        return _latestPriceQuote;
    },
    getCompanyName: function (symbol) {
        var _quote = YahooFinance.snapshot({symbols: [symbol], fields: ['n']});
        return _quote[symbol].name;
    }
});