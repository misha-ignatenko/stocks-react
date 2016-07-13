var _maxStocksAllowedPerUnregisteredUser = 5;

Meteor.methods({
    getStockPricesFromYahooFinance: function (symbol, startDate, endDate) {
        console.log("requesting from yahoo finance: ", symbol, startDate, endDate);
        return YahooFinance.historical({
            symbol: symbol,
            from: startDate,
            to: endDate
        });
    },
    stockPriceInsertAttempt: function (stockPriceObj) {
        var _symbol = stockPriceObj.symbol;
        var _dateString = stockPriceObj.dateString;

        var _obj = NewStockPrices.findOne({symbol: _symbol, dateString: _dateString});

        if (!_obj) {
            console.log("did not find an obj so gonna insert");
            return NewStockPrices.insert(stockPriceObj)
        } else {
            console.log("object already exists in db");
            return _obj._id + '_existing';
        }
    },

    setPricesLoadingTag: function(symbol, bool) {
        Stocks.update(
            {_id: symbol},
            {$set: {
                pricesBeingPulledRightNow: bool
            }},
            {multi: true}
        );
    },

    getStockPricesNew: function(symbol, startStr, endStr) {
        console.log("in the outer method getStockPrices New");
        var _res;

        var _existingStartDate = NewStockPrices.findOne({symbol: symbol}, {sort: {dateString: 1}});
        if (_existingStartDate) {
            _existingStartDate = _existingStartDate.dateString;
            console.log("start date: ", _existingStartDate)
        }

        var _existingEndDate = NewStockPrices.findOne({symbol: symbol}, {sort: {dateString: -1}});
        if (_existingEndDate) {
            _existingEndDate = _existingEndDate.dateString;
            console.log("end date: ", _existingEndDate)
        }

        var _pullNewData = true;

        var _startUpd;
        var _endUpd;

        if (_existingStartDate && _existingEndDate && _existingStartDate <= startStr && _existingEndDate >= endStr) {
            // this means that all data already exists in the requested date range so no need to pull anything new
            _pullNewData = false;
            _startUpd = _existingStartDate;
            _endUpd = _existingEndDate;
        } else if (_existingStartDate && _existingEndDate) {
            // this means that there is SOME data but not everything that we want exists yet
            _pullNewData = true;
            // now reset startStr and endStr
            var _allDateNums = [
                parseInt(_existingStartDate.replace(/-/g, '')),
                parseInt(_existingEndDate.replace(/-/g, '')),
                parseInt(startStr.replace(/-/g, '')),
                parseInt(endStr.replace(/-/g, ''))
            ]

            // modify startStr and endStr that will go into the getStockPricesFromYahooFinance method below
            var _minDateStrNoDashes = _.min(_allDateNums).toString();
            var _maxDateStrNoDashes = _.max(_allDateNums).toString();

            startStr = _minDateStrNoDashes.substring(0,4) + '-' + _minDateStrNoDashes.substring(4,6) + '-' + _minDateStrNoDashes.substring(6,8);
            endStr = _maxDateStrNoDashes.substring(0,4) + '-' + _maxDateStrNoDashes.substring(4,6) + '-' + _maxDateStrNoDashes.substring(6,8);
            _startUpd = startStr;
            _endUpd = endStr;
        } else {
            // there is no existing start or end date
            _pullNewData = true;
            _startUpd = startStr;
            _endUpd = endStr;
        }

        if (_pullNewData && startStr <= endStr) {
            Meteor.call('getStockPricesFromYahooFinance', symbol, startStr, endStr, function (error, result) {
                if (!error && result) {
                    console.log("got a result from Yahoo Finance. the length of result is: ", result.length);
                    // inner futures link: http://stackoverflow.com/questions/25940806/meteor-synchronizing-multiple-async-queries-before-returning

                    var _getStockPricesFromYahooFinanceResults = [];
                    result.forEach(function (priceObj) {
                        var _isoDateString = priceObj.date.toISOString();
                        var _dateString = _isoDateString.substring(0, 10);

                        var _stockPriceObjToAttemptInsering = _.extend(priceObj, {
                            dateString: _dateString
                        });

                        Meteor.call('stockPriceInsertAttempt', _stockPriceObjToAttemptInsering, function (error, result) {
                            if (error) {
                                _getStockPricesFromYahooFinanceResults.push(error);
                            } else {
                                _getStockPricesFromYahooFinanceResults.push(result);
                            }
                        })
                    });

                    _res = _getStockPricesFromYahooFinanceResults;

                } else {
                    _res = error;
                }
            })
        } else {
            _res = 'already have all the needed stock prices data';
        }

        Stocks.update(
            {_id: symbol},
            {$set: {
                minRequestedStartDate: _startUpd,
                maxRequestedEndDate: _endUpd,
                pricesBeingPulledRightNow: false
            }},
            {multi: true}
        );

        return _res;
    },
    addNewSymbolMapping: function(localStr, fromStr, universalStr) {
        var _obj = {
            symbolStr: localStr,
            from: fromStr,
            universalSymbolStr: universalStr
        };
        if (SymbolMappings.find(_obj).count() == 0) {
            return SymbolMappings.insert(_obj);
        }
    }
    , getPricesNewForAllStocks: function(startStr, endStr, keyCode) {
        var _allUniqueSymbols = _.uniq(_.pluck(Stocks.find({}, {fields: {_id: 1}}).fetch(), '_id'));
        console.log("the length of all unique symbols is: ", _allUniqueSymbols.length);
        console.log("----------------------------------");

        var _existingUniqStockPriceSymbols = _.uniq(_.pluck(NewStockPrices.find({}, {fields: {symbol: 1}}).fetch(), 'symbol'));
        var _stocksThatAreNotInStockPricesYet = _.difference(_allUniqueSymbols, _existingUniqStockPriceSymbols);

        var _initialIndex = 0;
        if (keyCode === Settings.findOne().dataImports.earningsReleases.quandlZeaAuthToken) {
            _recursiveF(_stocksThatAreNotInStockPricesYet, _initialIndex, startStr, endStr);
        } else {
            console.log("wrong key code.");
        }
    }
})


function _recursiveF(arr, index, startStr, endStr) {
    if (index <= arr.length - 1) {
        var _symbol = arr[index];
        console.log("getting prices for: ", _symbol, startStr, endStr);
        console.log('the index is: ', index);
        Meteor.call('getStockPricesFromYahooFinance', _symbol, startStr, endStr, function (error, result) {
            if (!error && result) {
                console.log("got a result from Yahoo Finance. the length of result is: ", result.length);
                // inner futures link: http://stackoverflow.com/questions/25940806/meteor-synchronizing-multiple-async-queries-before-returning

                result.forEach(function (priceObj) {
                    var _dateString = moment.tz(priceObj.date.toISOString(), "America/New_York").format('YYYY-MM-DD');

                    var _stockPriceObjToAttemptInsering = _.extend(priceObj, {
                        dateString: _dateString
                    });

                    NewStockPrices.insert(_stockPriceObjToAttemptInsering)
                });

            } else {
                console.log("there was an error for symbol: ", _symbol);
            }
            console.log('------------------------------------------');
            _recursiveF(arr, index + 1, startStr, endStr);
        });
    }
};

if (Meteor.isServer) {
    Meteor.publish("earningsReleases", function (startDate, endDate) {
        var _allEarningsReleases = EarningsReleases.find({$and: [
            {
                reportDateNextFiscalQuarter: {
                    $exists: true
                }
            },
            {
                reportDateNextFiscalQuarter: {
                    $gte: startDate
                }
            },
            {
                reportDateNextFiscalQuarter: {
                    $lte: endDate
                }
            }
        ]}, {sort: {reportSourceFlag: 1, reportDateNextFiscalQuarter: 1, asOf: -1}});

        return _allEarningsReleases;
    });

    Meteor.publish("pickLists", function () {
        return PickLists.find();
    });

    Meteor.publish("portfolios", function() {
        if (this.userId) {
            //portfolios that are either public or the user is owner
            return Portfolios.find({ $or: [ {private: false}, {owner: this.userId} ] }, {fields: {_id: 1, name: 1, firmId: 1, owner: 1, private: 1, ownerName: 1}});
        } else {
            return Portfolios.find({private: false}, {fields: {_id: 1, name: 1, ownerName: 1}});
        }
    });

    Meteor.publish("pickListItems", function () {
        return PickListItems.find();
    });

    Meteor.publish(null, function() {
        var _user = this.userId ? Meteor.users.find({_id: this.userId}, {fields: {_id: 1, username: 1, individualStocksAccess: 1, registered: 1, lastModified: 1, showDataImportsTab: 1}}) : null;
        return _user;
    });

    Meteor.publish("ratingScales", function() {
        return RatingScales.find({}, {fields: {_id: 1, universalScaleValue: 1, researchFirmId: 1}});
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
        _createdUser.permissions = {};
        _createdUser.showDataImportsTab = false;

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
        getFullQuote: function (symbolsArray) {
            return YahooFinance.snapshot({symbols: symbolsArray});
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
                        Meteor.call("insertNewStockSymbols", [symbol]);
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
        },
        insertNewStockSymbols: function(symbolsArray) {
            var _symbolsAllCapsArray = [];
            symbolsArray.forEach(function(symbol) {
                _symbolsAllCapsArray.push(symbol.toUpperCase());
            });

            if (_symbolsAllCapsArray.length > 0) {
                Meteor.call("getFullQuote", _symbolsAllCapsArray, function(error, quotesArray) {
                    if (!error && quotesArray && quotesArray.length > 0) {
                        quotesArray.forEach(function(quote) {
                            if (quote.stockExchange) {
                                var _symbolUpperCase = quote.symbol.toUpperCase();
                                if (Stocks.find({_id: _symbolUpperCase}).count() === 0) {
                                    Stocks.insert({
                                        _id: _symbolUpperCase,
                                        quote: _.extend(quote, {
                                            asOf: new Date().toISOString()
                                        })
                                    });
                                }
                            }
                        });
                    }
                });
            }
        }
    });
}