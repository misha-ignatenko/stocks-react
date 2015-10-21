if (Meteor.isServer) {
    Meteor.publish("earningsReleases", function () {
        return EarningsReleases.find();
    });
    Meteor.publish("ratingChanges", function () {
        return RatingChanges.find();
    });
    Meteor.publish("researchCompanies", function () {
        return ResearchCompanies.find();
    });
    Meteor.publish("stockPrices", function () {
        return StockPrices.find();
    });
    Meteor.publish("gradingScales", function () {
        return GradingScales.find();
    });
    Meteor.publish("pickLists", function () {
        return PickLists.find();
    });

    Meteor.publish("pickListItems", function () {
        return PickListItems.find();
    });

    //var _pickListItemsObjects = Meteor.call('getStartupPickListData');
    //_pickListItemsObjects.forEach(function(obj) {
    //    var _pickListIdInProcess = obj.pickListId;
    //    var _pickListItemsInProcess = obj.pickListItems;
    //    console.log("pickListId: ", _pickListIdInProcess);
    //    if (PickListItems.find({pickListId: _pickListIdInProcess}).count() === 0 ) {
    //        console.log("there are zero items in the following pick list id: ", _pickListIdInProcess);
    //        console.log("inserting ", _pickListItemsInProcess.length, " pick list items into pickListItems colleciton.");
    //        _pickListItemsInProcess.forEach(function(obj) {
    //            PickListItems.insert(obj);
    //        });
    //    }
    //});


    Meteor.methods({
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
        removeStockFromPickList: function(pickListId, stockId) {
            //TODO check for duplicated dateRemoved
        },
        removePickList: function(pickListId) {
            PickLists.remove(pickListId);
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
                var _requestedStartDateInUTC = new Date(startDate).toUTCString();
                var _requestedEndDateInUTC = new Date(endDate).toUTCString();
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
                    existingStartDate: new Date(startDate).toUTCString(),
                    existingEndDate: new Date(endDate).toUTCString(),
                    symbol: symbol
                });
            }

            return StockPrices.findOne({symbol: symbol});
            //TODO return historical data based on start date and end date, DO NOT just return the whole historical data that is available from previous yahoo finance requests.
        },
        getHistoricalData: function(symbol, start, end) {
            var _startDate = new Date(start).toUTCString();
            var _endDate = new Date(end).toUTCString();
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