Meteor.publish("settings", function () {
    return Settings.find({type: "main"}, {fields: {_id: 1, clientSettings: 1}});
});

Meteor.publish("ratingChangesForSymbols", function (symbolsArr) {
    return RatingChanges.find({symbol: {$in: symbolsArr}}, {fields: {_id: 1, symbol: 1, date: 1, oldRatingId: 1, newRatingId: 1, researchFirmId: 1}});
});