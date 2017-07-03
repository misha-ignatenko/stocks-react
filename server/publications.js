Meteor.publish("settings", function () {
    return Settings.find({type: "main"}, {fields: {_id: 1, clientSettings: 1}});
});


// RatingChanges publications
Meteor.publish("ratingChangesForSymbols", function (symbolsArr, start_YYYY_MM_DD, end_YYYY_MM_DD) {
    return RatingChanges.find({
        symbol: {$in: symbolsArr}, $and: [{dateString: {$gte: start_YYYY_MM_DD}}, {dateString: {$lte: end_YYYY_MM_DD}}]
    }, {
        fields: {_id: 1, symbol: 1, date: 1, dateString: 1, oldRatingId: 1, newRatingId: 1, researchFirmId: 1}
    }, {
        sort: {dateString: 1}
    });
});
Meteor.publish("ratingChangesForPortfolioCriteria", function (portfolioId, startDate, endDate) {
    console.log("inside ratingChangesForPortfolioCriteria, portfolioid: ", portfolioId, startDate, endDate);
    var _criteria = Portfolios.findOne(portfolioId).criteria;
    var _ratingScaleIds = [];
    _.each(_criteria, function (criterion) {
        var _cr = JSON.parse(criterion);
        _ratingScaleIds = _ratingScaleIds.concat(_.pluck(RatingScales.find(_cr).fetch(), "_id"));
    })
    var _uniqRatingScaleIds = _.uniq(_ratingScaleIds);

    return RatingChanges.find({
        newRatingId: {$in: _uniqRatingScaleIds}, $and: [{dateString: {$gte: startDate}}, {dateString: {$lte: endDate}}]
    }, {
        fields: {_id: 1, symbol: 1, date: 1, dateString: 1, oldRatingId: 1, newRatingId: 1, researchFirmId: 1}
    }, {
        sort: {dateString: 1}
    });
})


// RatingScales publications
Meteor.publish("specificRatingScales", function(ratingScaleIdsArr) {
    return RatingScales.find({_id: {$in: ratingScaleIdsArr}}, {fields: {_id: 1, universalScaleValue: 1, researchFirmId: 1}});
});
Meteor.publish("ratingScales", function() {
    return RatingScales.find({}, {fields: {_id: 1, universalScaleValue: 1, researchFirmId: 1}});
})

Meteor.publish("stockPricesFor", function(symbolsArr, startStr, endStr) {
    return NewStockPrices.find(
        {
            symbol: {$in: symbolsArr}, $and: [{dateString: {$gte: startStr}}, {dateString: {$lte: endStr}}]
        }, {
            fields: {importedOn: 0, importedBy: 0}
        }, {
            sort: {dateString: 1}
        }
    );
});

Meteor.publish("stockPricesSpecificDates", function(mapObj) {
    // this mapping will generate an array of OR conditions for a specific date and an array of symbols of interest for that date
    let _orStmt = _.map(mapObj, function (value, key) {
        return {
            dateString: key,
            symbol: { $in: value }
        };
    });

    return NewStockPrices.find(
        {
            $or: _orStmt
        }, {
            fields: {
                _id: 1,
                symbol: 1,
                dateString: 1,
                adjClose: 1
            }
        }, {
            sort: {dateString: 1}
        }
    );
});

Meteor.publish("allStockNames", function() {
    return Stocks.find({}, {fields: {_id: 1, minRequestedStartDate: 1, maxRequestedEndDate: 1, pricesBeingPulledRightNow: 1}});
});

Meteor.publish("getPortfolioById", function(portfId) {
    if (this.userId) {
        //portfolios that are either public or the user is owner
        return Portfolios.find(
            { _id: portfId, $or: [ {private: false}, {ownerId: this.userId} ] },
            {fields: {_id: 1, name: 1, researchFirmId: 1, ownerId: 1, private: 1, rolling: 1, lookback: 1, criteria: 1}}
        );
    } else {
        return Portfolios.find({_id: portfId, private: false}, {fields: {_id: 1, name: 1}});
    }
});

Meteor.publish("portfolioItems", function(portfolioIds, startStr, endStr) {
    return PortfolioItems.find({
        portfolioId: {$in: portfolioIds}, $and: [{dateString: {$gte: startStr}}, {dateString: {$lte: endStr}}]
    }, {
        sort: {dateString: 1}
    });
});

Meteor.publish("allNewStockPricesForDate", function(dateStr) {
    return NewStockPrices.find(
        {
            dateString: dateStr
        }, {
            fields: {
                _id: 1,
                dateString: 1,
                symbol: 1
            }
        });
})