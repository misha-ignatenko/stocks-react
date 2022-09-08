import { check } from 'meteor/check';

Meteor.publish("settings", function () {
    return Settings.find({type: "main"}, {fields: {_id: 1, clientSettings: 1}});
});

// RatingChanges publications
Meteor.publish("ratingChangesForSymbols", function (symbolsArr, start_YYYY_MM_DD, end_YYYY_MM_DD) {
    check(symbolsArr, [String]);
    check(start_YYYY_MM_DD, String);
    check(end_YYYY_MM_DD, String);

    return RatingChanges.find({
        symbol: {$in: symbolsArr}, $and: [{dateString: {$gte: start_YYYY_MM_DD}}, {dateString: {$lte: end_YYYY_MM_DD}}]
    }, {
        fields: {_id: 1, symbol: 1, date: 1, dateString: 1, oldRatingId: 1, newRatingId: 1, researchFirmId: 1},
        sort: {dateString: 1},
    });
});
Meteor.publish("allRatingChangesForSymbol", function (symbol) {
    check(symbol, String);

    return RatingChanges.find({
        symbol: symbol,
    }, {
        fields: {_id: 1, symbol: 1, date: 1, dateString: 1, oldRatingId: 1, newRatingId: 1, researchFirmId: 1},
        sort: {dateString: 1},
    });
});


// RatingScales publications
Meteor.publish("specificRatingScales", function(ratingScaleIdsArr) {
    check(ratingScaleIdsArr, [String]);

    return RatingScales.find({_id: {$in: ratingScaleIdsArr}}, {fields: {_id: 1, universalScaleValue: 1, researchFirmId: 1}});
});
Meteor.publish("ratingScales", function() {
    console.log("inside ratingScales publication");
    return RatingScales.find({}, {fields: {_id: 1, universalScaleValue: 1, researchFirmId: 1}});
});

Meteor.publish("getPortfolioById", function(portfId) {
    check(portfId, String);

    if (this.userId) {
        //portfolios that are either public or the user is owner
        return Portfolios.find(
            { _id: portfId, $or: [ {private: false}, {ownerId: this.userId} ] },
            {fields: {_id: 1, name: 1, researchFirmId: 1, ownerId: 1, private: 1, rolling: 1, lookback: 1, criteria: 1, criteriaType: 1}}
        );
    } else {
        return Portfolios.find({_id: portfId, private: false}, {fields: {_id: 1, name: 1}});
    }
});
