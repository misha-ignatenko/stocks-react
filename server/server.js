var _maxStocksAllowedPerUnregisteredUser = 5;

if (Meteor.isServer) {
    Meteor.publish("earningsReleases", function () {
        return EarningsReleases.find();
    });
    Meteor.publish("stockPrices", function () {
        return StockPrices.find();
    });
    Meteor.publish("pickLists", function () {
        return PickLists.find();
    });

    Meteor.publish("pickListItems", function () {
        return PickListItems.find();
    });

    Meteor.publish(null, function() {
        var _user = this.userId ? Meteor.users.find({_id: this.userId}, {fields: {_id: 1, username: 1, individualStocksAccess: 1, registered: 1, lastModified: 1}}) : null;
        return _user;
    });

    Meteor.publish("ratingChangesForSymbol", function(symbol) {
        return RatingChanges.find({symbol: symbol}, {fields: {_id: 1, symbol: 1, date: 1, oldRatingId: 1, newRatingId: 1, researchFirmId: 1}});
    });

    Meteor.publish("ratingScales", function() {
        return RatingScales.find({}, {fields: {_id: 1, universalScaleValue: 1}});
    })

    Accounts.onCreateUser(function(options, user) {
        var _createdUser;
        if (options.registered === undefined) {
            _createdUser = _.extend(user, {registered: false});
        } else {
            _createdUser = _.extend(user, {registered: options.registered});
        }

        //set premium to false no matter what
        _createdUser.premium = false;

        return _createdUser;
    })

    Meteor.methods({
        getHistoricalDataAfter: function (_stockPricesObj, symbol, endDate) {
            var _done = _stockPricesObj;
            //need to pull new stock info from _stockPricesObj.existingEndDate to _requestedEndDateInUTC
            //update stockprices entry accordingly
            //be careful about dates
            var _startDateForRequest = moment(_stockPricesObj.existingEndDate).add(1, "days").format("YYYY-MM-DD");
            Meteor.call('getHistoricalData', symbol, _startDateForRequest, endDate, function (error, result) {
                if (!error && result && result.length > 0) {
                    var _actualEndDateFromQuery = moment(result[result.length - 1].date).format("YYYY-MM-DD");
                    var _newHistoricalDataToAddToTheRight = result;
                    var _previousHistoricalData = _stockPricesObj.historicalData;
                    _newHistoricalDataToAddToTheRight.forEach(function (obj) {
                        _previousHistoricalData.push(obj);
                    });
                    _done.historicalData = _previousHistoricalData;
                    _done.existingEndDate = _actualEndDateFromQuery;
                }
            });
            return _done;
        },

        getHistoricalDataBefore: function (_stockPricesObj, symbol, startDate) {
            var _done = _stockPricesObj;
            //need to pull new stock prices info from _requestedStartDateInUTC until _stockPricesObj.existingStartDate
            var _endDateForRequest = moment(_stockPricesObj.existingStartDate).subtract(1, "days").format("YYYY-MM-DD");
            Meteor.call('getHistoricalData', symbol, startDate, _endDateForRequest, function (error, result) {
                if (!error && result && result.length > 0) {
                    var _actualStartDateFromQuery = moment(result[0].date).format("YYYY-MM-DD");
                    var _newHistoricalDataToAddToTheLeft = result;
                    var _previousHistoricalData = _stockPricesObj.historicalData;
                    _previousHistoricalData.forEach(function (obj) {
                        _newHistoricalDataToAddToTheLeft.push(obj);
                    });
                    _done.historicalData = _newHistoricalDataToAddToTheLeft;
                    _done.existingStartDate = _actualStartDateFromQuery;
                }
            });
            return _done;
        },

        getRatingChangesFor: function(symbol) {
            var _userId = this.userId;
            var _user = Meteor.users.findOne({_id: _userId});
            //show researchFirmString ONLY if user is premium

            return _user.premium ?
                RatingChanges.find({symbol: symbol}, {fields: {_id: 1, symbol: 1, date: 1, oldRatingId: 1, newRatingId: 1, researchFirmId: 1}}).fetch() :
                RatingChanges.find({symbol: symbol}, {fields: {_id: 1, symbol: 1, date: 1, oldRatingId: 1, newRatingId: 1}}).fetch();
        },
        registerRealAccountFromDummy: function(dummyUserId, newUsername, newPassword) {
            Accounts.setUsername(dummyUserId, newUsername);
            Accounts.setPassword(dummyUserId, newPassword);
            Meteor.users.update({_id: dummyUserId}, {$set: {registered: true}});
            return {username: newUsername, password: newPassword};
        },
        addIndividualStockToUser: function(userId, symbol) {
            var _user = Meteor.users.findOne(userId);
            if (_user.individualStocksAccess &&
                (_user.individualStocksAccess.length < _maxStocksAllowedPerUnregisteredUser || _user.registered) &&
                _.indexOf(_user.individualStocksAccess, symbol) === -1
            ) {
                Meteor.users.update({_id: userId}, {$push: { individualStocksAccess: symbol }});
            } else if (!_user.individualStocksAccess) {
                Meteor.users.update({_id: userId}, {$set: { individualStocksAccess: [symbol]}});
            }
        },
        addPickList: function(pickListName, pickListDate, stocksList) {
            // Make sure the user is logged in before inserting a task
            if (! Meteor.userId()) {
                throw new Meteor.Error("not-authorized");
            }

            PickLists.insert({
                listName: pickListName,
                pickListDate: pickListDate,
                stocksList: stocksList,
                addedBy: Meteor.userId(),
                addedByUsername: Meteor.user().username
            });
        },
        addStockToPickList: function(pickListId, symbol, dateAdded) {
            var _alreadyExistingPickListItem = PickListItems.findOne({
                pickListId: pickListId,
                stockId: symbol,
                dateAdded: dateAdded
            });
            if (_alreadyExistingPickListItem) {
                console.log("attempt to enter duplicate pick list item prevented. item id: ", _alreadyExistingPickListItem._id, ", stock symbol: ", _alreadyExistingPickListItem.stockId);
            } else {
                Meteor.call("getCompanyName", symbol, function(error, result) {
                    if (!error && result) {
                        PickListItems.insert({
                            pickListId: pickListId,
                            stockId: symbol,
                            dateAdded: dateAdded
                        });
                    }
                });
            }
        },
        removeStockFromPickList: function(pickListItemId, dateRemoved) {
            var _pickListItem = PickListItems.findOne(pickListItemId);
            if (_pickListItem && !_pickListItem.dateRemoved) {
                PickListItems.update({_id: pickListItemId}, {$set: {dateRemoved: dateRemoved}})
            }
        },
        removePickList: function(pickListId) {
            PickLists.remove(pickListId);
        },
        removePickListItem: function(pickListItemId) {
            PickListItems.remove(pickListItemId);
        },
        getFullQuote: function (symbol) {
            var _fullQuote = YahooFinance.snapshot({symbols: [symbol]});
            return _fullQuote;
        },
        getLatestAskPrice: function (symbol) {
            var _latestPriceQuote = YahooFinance.snapshot({symbols: [symbol], fields: ['s', 'n', 'd1', 'l1', 'y', 'r']});
            return _latestPriceQuote;
        },
        getCompanyName: function (symbol) {
            var _quotes = YahooFinance.snapshot({symbols: [symbol], fields: ['n']});
            var _filteredQuote = _.findWhere(_quotes, {symbol: symbol});
            return _filteredQuote.name;
        },
        checkHistoricalData: function(symbol, startDate, endDate) {
            console.log("get HistoricalData method being called for: ", symbol, ", start date: ", startDate, ", end date: ", endDate, ".");

            //TODO first need to check if historical stock data exists in stockPrices collection.
            //TODO if data is not there, then select which data is missing: startDateInCollection minus startDate and endDate minus endDateInCollection
            //get data from yahoo finance for those two time intervals
            //if data is already in
            //update the existingStartDate and existingEndDate after pulling new data
            var _stockPricesObj = StockPrices.findOne({symbol: symbol});
            if (_stockPricesObj && _stockPricesObj.historicalData && _stockPricesObj.existingStartDate && _stockPricesObj.existingEndDate) {
                //this means there IS previously recorded data in the StockPrices object for the selected stock symbol.


                if (moment(startDate).isBefore(_stockPricesObj.existingStartDate) &&
                    moment(endDate).isAfter(_stockPricesObj.existingEndDate)
                ) {
                    Meteor.call("getHistoricalDataBefore", _stockPricesObj, symbol, startDate, function(error, result) {
                        if (!error && result) {
                            Meteor.call("getHistoricalDataAfter", result, symbol, endDate, function(error2, result2) {
                                if (!error2 && result2) {
                                    _stockPricesObj = result2;
                                }
                            });
                        }
                    });
                }
                //two cases
                //one is when the requested startDate is earlier than what already have
                else if (moment(startDate).isBefore(_stockPricesObj.existingStartDate)) {
                    Meteor.call("getHistoricalDataBefore", _stockPricesObj, symbol, startDate, function(error, result) {
                        _stockPricesObj = result;
                    });
                }
                //two is when the requested endDate is later than what already have
                else if (moment(endDate).isAfter(_stockPricesObj.existingEndDate)) {
                    Meteor.call("getHistoricalDataAfter", _stockPricesObj, symbol, endDate, function(error, result) {
                        _stockPricesObj = result;
                    });
                }
                var _id = _stockPricesObj._id;
                delete _stockPricesObj._id;

                StockPrices.update({_id: _id}, {$set: _stockPricesObj});


            } else {
                //this means that there is no data at all in the StockPrices array so we need to just pull it from Yahoo Finance
                //AND update existingStartDate and existingEndDate to startDate and endDate correspondingly.
                console.log("initializing historical data because stockprices object doesn't exist.");
                Meteor.call('getHistoricalData', symbol, startDate, endDate, function(error, result) {
                    if (!error && result && result.length > 0) {
                        var _actualStartDateFromQuery = moment(result[0].date).format("YYYY-MM-DD");
                        var _actualEndDateFromQuery = moment(result[result.length - 1].date).format("YYYY-MM-DD");
                        var _historicalData = result;
                        StockPrices.insert({
                            historicalData: _historicalData,
                            existingStartDate: _actualStartDateFromQuery,
                            existingEndDate: _actualEndDateFromQuery,
                            symbol: symbol
                        });
                    }
                });
            }

            var _historicalDataBetweenTwoRequestedDates = [];
            var _stockPricesRecord = StockPrices.findOne({symbol: symbol});
            if (_stockPricesRecord && _stockPricesRecord.historicalData) {
                var _allHistoricalData = _stockPricesRecord.historicalData;
                //push items from _allHistoricalData to _historicalDataBetweenTwoRequestedDates
                //only where dates are within the requested date range
                _allHistoricalData.forEach(function(priceObjForDay) {
                    var _extractedDateStringNoTimezone = moment(new Date(priceObjForDay.date)).format("YYYY-MM-DD");
                    if ((moment(_extractedDateStringNoTimezone).isSame(startDate) || moment(_extractedDateStringNoTimezone).isAfter(startDate)) &&
                        (moment(_extractedDateStringNoTimezone).isSame(endDate) || moment(_extractedDateStringNoTimezone).isBefore(endDate))
                    ) {
                        _historicalDataBetweenTwoRequestedDates.push(priceObjForDay);
                    }
                });
                //this will limit the historicalData attribute that we are making available to the user
                _stockPricesRecord.historicalData = _historicalDataBetweenTwoRequestedDates;
            }
            return _stockPricesRecord;
        },
        getHistoricalData: function(symbol, start, end) {
            console.log("requesting from yahoo finance: ", start, end);
            return YahooFinance.historical({
                symbol: symbol,
                from: start,
                to: end
            });
        },
        getBlah: function() {
            var _blah = "blah";
            return _blah;
        },
        getDataForSeriesData: function(symbol, start, end) {
            //todo delete this method if not being used anyhere
            var _result = StockPrices.findOne({symbol: symbol}).historicalData;
            return _result;
        }
    });
}