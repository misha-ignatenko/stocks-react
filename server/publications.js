Meteor.publish("settings", function () {
    return Settings.find({type: "main"}, {fields: {_id: 1, clientSettings: 1}});
});

Meteor.publish("ratingChangesForSymbols", function (symbolsArr, start_YYYY_MM_DD, end_YYYY_MM_DD) {
    return RatingChanges.find({symbol: {$in: symbolsArr}, $and: [{dateString: {$gte: start_YYYY_MM_DD}}, {dateString: {$lte: end_YYYY_MM_DD}}]}, {fields: {_id: 1, symbol: 1, date: 1, dateString: 1, oldRatingId: 1, newRatingId: 1, researchFirmId: 1}});
});

Meteor.publish("stockPricesFor", function(symbolsArr) {
    return StockPrices.find({symbol: {$in: symbolsArr}});
});

Meteor.publish("allStockNames", function() {
    return Stocks.find({}, {fields: {_id: 1}});
});