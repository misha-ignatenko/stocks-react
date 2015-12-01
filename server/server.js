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
        getRatingChangesFor: function(symbol) {
            var _userId = this.userId;
            var _user = Meteor.users.findOne({_id: _userId});
            //show researchFirmString ONLY if user is premium

            return _user.premium ?
                RatingChanges.find({symbol: symbol}, {fields: {_id: 1, symbol: 1, date: 1, oldRatingValue: 1, newRatingValue: 1, researchFirmString: 1}}).fetch() :
                RatingChanges.find({symbol: symbol}, {fields: {_id: 1, symbol: 1, date: 1, oldRatingValue: 1, newRatingValue: 1}}).fetch();
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
        addStockToPickList: function(pickListId, stockId, dateAdded) {
            var _alreadyExistingPickListItem = PickListItems.findOne({
                pickListId: pickListId,
                stockId: stockId,
                dateAdded: dateAdded
            });
            if (_alreadyExistingPickListItem) {
                console.log("attempt to enter duplicate pick list item prevented. item id: ", _alreadyExistingPickListItem._id, ", stock symbol: ", _alreadyExistingPickListItem.stockId);
            } else {
                PickListItems.insert({
                    pickListId: pickListId,
                    stockId: stockId,
                    dateAdded: dateAdded
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
            var _quote = YahooFinance.snapshot({symbols: [symbol], fields: ['n']});
            return _quote[symbol].name;
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



                //two cases
                //one is when the requested startDate is earlier than what already have
                var _requestedStartDateInUTC = moment(startDate).utc().format();
                var _requestedEndDateInUTC = moment(endDate).utc().format();
                if (_requestedStartDateInUTC < _stockPricesObj.existingStartDate) {
                    //need to pull new stock prices info from _requestedStartDateInUTC until _stockPricesObj.existingStartDate
                    var _newHistoricalDataToAddToTheLeft = Meteor.call('getHistoricalData', symbol, _requestedStartDateInUTC, _stockPricesObj.existingStartDate);
                    var _previousHistoricalData = _stockPricesObj.historicalData;
                    _previousHistoricalData.forEach(function(obj) {
                        _newHistoricalDataToAddToTheLeft.push(obj);
                    });
                    StockPrices.update({_id: _stockPricesObj._id}, {$set: {
                        historicalData: _newHistoricalDataToAddToTheLeft,
                        existingStartDate: _requestedStartDateInUTC
                    }});
                }
                //two is when the requested endDate is later than what already have
                if (_requestedEndDateInUTC > _stockPricesObj.existingEndDate) {
                    //need to pull new stock info from _stockPricesObj.existingEndDate to _requestedEndDateInUTC
                    //update stockprices entry accordingly
                    //be careful about dates
                    var _newHistoricalDataToAddToTheRight = Meteor.call('getHistoricalData', symbol, _stockPricesObj.existingEndDate, _requestedEndDateInUTC);
                    var _previousHistoricalData = _stockPricesObj.historicalData;
                    _newHistoricalDataToAddToTheRight.forEach(function(obj) {
                        _previousHistoricalData.push(obj);
                    });
                    StockPrices.update({_id: _stockPricesObj._id}, {$set: {
                        historicalData: _previousHistoricalData,
                        existingEndDate: _requestedEndDateInUTC
                    }});
                }


            } else {
                //this means that there is no data at all in the StockPrices array so we need to just pull it from Yahoo Finance
                //AND update existingStartDate and existingEndDate to startDate and endDate correspondingly.
                console.log("initializing historical data because stockprices object doesn't exist.");
                var _historicalData = Meteor.call('getHistoricalData', symbol, startDate, endDate);
                StockPrices.insert({
                    historicalData: _historicalData,
                    existingStartDate: moment(startDate).utc().format(),
                    existingEndDate: moment(endDate).utc().format(),
                    symbol: symbol
                });
            }

            return StockPrices.findOne({symbol: symbol});
            //TODO return historical data based on start date and end date, DO NOT just return the whole historical data that is available from previous yahoo finance requests.
        },
        getHistoricalData: function(symbol, start, end) {
            var _startDate = moment(start).utc().format();
            var _endDate = moment(end).utc().format();
            console.log("requesting from yahoo finance: ", _startDate, _endDate);
            return YahooFinance.historical({
                symbol: symbol,
                from: _startDate,
                to: _endDate
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