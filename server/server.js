var _maxStocksAllowedPerUnregisteredUser = 5;

// FREE
function getWikiPricesQuandlUrl(dateStrYYYY_MM_DD, optionalSymbolsArr) {
    var _quandlFreeBaseUrl = "https://www.quandl.com/api/v3/datatables/WIKI/PRICES.json";
    var _apiKey = Settings.findOne({type: "main"}).dataImports.earningsReleases.quandlZeaAuthToken;
    if (dateStrYYYY_MM_DD && optionalSymbolsArr) {
        var _url = _quandlFreeBaseUrl + "?date=" +
            dateStrYYYY_MM_DD.replace(/-/g, '') + "&ticker=" + optionalSymbolsArr.join() + "&api_key=" +
            _apiKey;
    } else if (dateStrYYYY_MM_DD && !optionalSymbolsArr) {
        var _url = _quandlFreeBaseUrl + "?date=" +
            dateStrYYYY_MM_DD.replace(/-/g, '') + "&api_key=" +
            _apiKey;
    } else if (!dateStrYYYY_MM_DD && optionalSymbolsArr) {
        var _url = _quandlFreeBaseUrl + "?" +
            "date.gte=2014-01-01&" +
            "ticker=" + optionalSymbolsArr.join() + "&api_key=" +
            _apiKey;
    }

    return _url;
};

// PAID
function getNasdaqPricesQuandlUrl(symbol, startDate, endDate) {
    var _url = "https://www.quandl.com/api/v3/datasets/XNAS/" + symbol + ".json?" +
        (startDate ? ("start_date=" + startDate + "&") : "") +
        (endDate ? ("end_date=" + endDate + "&") : "") +
        "api_key=" + Settings.findOne().dataImports.earningsReleases.quandlZeaAuthToken;

    return _url;
}

Meteor.methods({
    insertAltRatingScale: function (firmNameStr, mainRatingString, mainRatingStringExactMatchBool, alternativeRatingString) {
        var _user = Meteor.user();
        if (!_user) {
            throw new Meteor.Error("Please log in.");
        } else {
            var _dataImportPermissions = _user.permissions && _user.permissions.dataImports;
            var _canImportRatingScales = _dataImportPermissions && _.contains(_dataImportPermissions, "canImportRatingScales");
            if (!_canImportRatingScales) {
                throw new Meteor.Error("You do not have permission to import rating scales.");
            }
        }

        var _researchFirmQuery = {
            name: { $regex: firmNameStr }
        };
        var _firms = ResearchCompanies.find(_researchFirmQuery).fetch();

        var _firmId = _firms.length === 1 ? _firms[0]._id : null;
        if (_firmId) {
            console.log("the firm id is: ", _firmId);
            var _ratingScaleQuery = {
                firmRatingFullString: mainRatingStringExactMatchBool ? mainRatingString : { $regex: mainRatingString },
                researchFirmId: _firmId
            };
            var _ratingScales = RatingScales.find(_ratingScaleQuery).fetch();

            var _ratingScaleId = _ratingScales.length === 1 ? _ratingScales[0]._id : null;
            if (_ratingScaleId) {
                console.log("rating scale id: ", _ratingScaleId);

                var _alternativeRatingScale = {
                    researchFirmId: _firmId,
                    type: "alternative",
                    ratingString: alternativeRatingString,
                    referenceRatingScaleId: _ratingScaleId
                };

                if (!RatingScales.findOne(_alternativeRatingScale)) {
                    var _newId = RatingScales.insert(_alternativeRatingScale);
                    console.log("inserted id: ", _newId);
                }
            } else {
                console.log("cannot find exactly one rating scale with query: ", _ratingScaleQuery);
            }
        } else {
            console.log("cannot find firm with query: ", _researchFirmQuery);
        }

        return;
    },

    fixMissingPricesFor: function (symbols) {

        // step 1. check quandl_free: no date specified (false), each symbol in the symbols array, overwrite flag (true).
        Meteor.call("getQuandlPricesForDate", false, symbols, true);

        // step 2. check quandl_paid.
        var _nycDateTime = moment().tz("America/New_York");
        var _nycDateTimeString = _nycDateTime.format();
        var _latestDayDoneInNyc = _nycDateTimeString.slice(11, 19) > "21:00:00" ? _nycDateTimeString.slice(0, 10) : _nycDateTime.subtract(1, "days").format("YYYY-MM-DD");
        _.each(symbols, function (s) {
            Meteor.call("getStockPricesNew", s, "2014-01-01", _latestDayDoneInNyc, true);
        });

        // step 3. processSplits (only if there are any stock prices with missing adjClose).
        Meteor.call("processSplits", symbols);
    },

    getNASDAQquandlStockPrices: function (symbol, startDate, endDate) {
        try {
            var result = HTTP.get(getNasdaqPricesQuandlUrl(symbol, startDate, endDate));
            var _data = result.data.dataset.data;
            var _columnNames = _.map(result.data.dataset.column_names, function (rawColName) {
                return rawColName.replace(/ /g, "_");
            });

            var _formattedData = [];
            _.each(_data, function (obj, idx) {

                // check that all column names are present
                if (_columnNames.length === obj.length && _columnNames.length === 8) {
                    var _processedItem = {};
                    _.each(_columnNames, function (colName, colNameIdx) {
                        _processedItem[colName] = obj[colNameIdx];
                    });

                    var _convertedObj = {
                        "date": new Date(_processedItem.Date + "T00:00:00.000+0000"),
                        "open": _processedItem.Open,
                        "high": _processedItem.High,
                        "low": _processedItem.Low,
                        "close": _processedItem.Close,
                        "volume": _processedItem.Volume,
                        "symbol": symbol,
                        "dateString": _processedItem.Date,
                        "importedBy": Meteor.userId(),
                        "importedOn": new Date().toISOString(),
                        source: "quandl_paid",


                        adjFactor: _processedItem.Adjustment_Factor,
                        adjType: _processedItem.Adjustment_Type
                    };

                    _formattedData.push(_convertedObj);
                } else {
                    throw new Meteor.Error("missing keys for NASDAQ data import: ", symbol);
                }
            })

            return _formattedData;
        } catch (e) {
            throw new Meteor.Error(e.response.content);
        }
    },

    stockPriceInsertAttempt: function (stockPriceObj) {
        var _symbol = stockPriceObj.symbol;
        var _dateString = stockPriceObj.dateString;

        var _obj = NewStockPrices.findOne({symbol: _symbol, dateString: _dateString});

        if (!_obj) {
            console.log("did not find an obj so gonna insert: ", _dateString, _symbol);
            return NewStockPrices.insert(stockPriceObj)
        } else {
            console.log("object already exists in db: ", _dateString, _symbol);
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

    getStockPricesNew: function(symbol, startStr, endStr, startFromExistingEndDateBool) {
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

            if (startFromExistingEndDateBool) {
                // startStr one day after _existingEndDate
                // no need to overwrite minRequestedStartDate aka _startUpd
                startStr = moment(_existingEndDate).add(1, "days").format("YYYY-MM-DD");
                var _stock = Stocks.findOne(symbol);
                if (_stock && _stock.minRequestedStartDate) {
                    _startUpd = _stock.minRequestedStartDate;
                }
            }
        } else {
            // there is no existing start or end date
            _pullNewData = true;
            _startUpd = startStr;
            _endUpd = endStr;
        }

        if (_pullNewData && startStr <= endStr) {
            Meteor.call("getNASDAQquandlStockPrices", symbol, startStr, endStr, function (error, result) {
                if (!error && result) {
                    console.log("got a result from Yahoo Finance. the length of result is: ", result.length);
                    // inner futures link: http://stackoverflow.com/questions/25940806/meteor-synchronizing-multiple-async-queries-before-returning

                    var _getStockPricesFromYahooFinanceResults = [];
                    result.forEach(function (priceObj) {

                        Meteor.call('stockPriceInsertAttempt', priceObj, function (error, result) {
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
    },
    getDefaultPerformanceDatesFor: function(portfolioId) {
        var _p = Portfolios.findOne(portfolioId);
        var pItemsExist = _p && PortfolioItems.findOne({portfolioId: _p._id});
        var _minDateStr = pItemsExist ? PortfolioItems.findOne({portfolioId: _p._id}, {limit: 1, sort: {dateString: 1}}).dateString : "";
        var _maxDatrStr = pItemsExist ? PortfolioItems.findOne({portfolioId: _p._id}, {limit: 1, sort: {dateString: -1}}).dateString : "";

        if (_p.rolling && pItemsExist) {
            _minDateStr = moment(_minDateStr).tz("America/New_York").add(_p.lookback / 5 * 7, "days").format("YYYY-MM-DD");
        }
        
        // a case for combined portfolios (i.e., portfolios consisting of a screen by multiple criteria)
        if (_p.criteria) {
            var _ratingScaleIds = [];
            var _researchFirms = [];
            var _criteriaRatingScales = [];

            // the purpose of this for loop is to figure out the widest date range where RatingChanges match portfolio's criteria
            _.each(_p.criteria, function (criterion) {
                var _query = JSON.parse(criterion);
                var _ratingScales = RatingScales.find(_query).fetch();
                _criteriaRatingScales.push(_ratingScales);

                _.each(_ratingScales, function (ratingScaleObj) {
                    var ratingScaleId = ratingScaleObj._id;
                    _ratingScaleIds.push(ratingScaleId);
                    _researchFirms.push(ratingScaleObj.researchFirmId);

                    // check if a rating change with either that newRatingId or oldRatingId exists
                    var _rChDatesQry = {$or: [{newRatingId: ratingScaleId}, {oldRatingId: ratingScaleId}]};
                    var _ratingChangesExist = RatingChanges.findOne(_rChDatesQry);

                    var _newMin = _ratingChangesExist ? RatingChanges.findOne(_rChDatesQry, {limit: 1, sort: {dateString: 1}}).dateString : "";
                    var _newMax = _ratingChangesExist ? RatingChanges.findOne(_rChDatesQry, {limit: 1, sort: {dateString: -1}}).dateString : "";

                    _minDateStr = (_minDateStr === "" ? _newMin : _newMin < _minDateStr ? _newMin : _minDateStr);
                    _maxDatrStr = (_maxDatrStr === "" ? _newMax : _newMax > _maxDatrStr ? _newMax : _maxDatrStr);
                })
            });

            // final RatingChanges are where dateString is between the calculated min and max dates and
            // either newRatingId or oldRatingId is in the list of RatingScales of interest (based on
            // portfolio's criteria) -- meaning that some symbol's rating changed TO a rating scale of interest or
            // it changed FROM a rating scale of interest.
            var _finalRatingChanges = RatingChanges.find({
                $and: [{$or: [{newRatingId: {$in: _.uniq(_ratingScaleIds)}}, {oldRatingId: {$in: _.uniq(_ratingScaleIds)}}]}, {dateString: {$gte: _minDateStr}}, {dateString: {$lte: _maxDatrStr}}]
            }, {
                fields: {symbol: 1, dateString: 1, oldRatingId: 1, newRatingId: 1}
            }).fetch();

            return {
                criteriaRatingScales: _criteriaRatingScales,
                startDate: _minDateStr,
                endDate: _maxDatrStr,
                ratingChanges: _finalRatingChanges
            };
        }

        return {
            startDate: _minDateStr,
            endDate: _maxDatrStr
        };
    },

    ensureRatingChangesSymbolsDefinedInStocksCollection: function () {
        var _uniqRatingChangesSymbols = _.uniq(_.pluck(RatingChanges.find({}, {fields: {symbol: 1}}).fetch(), "symbol"));

        // make sure that all these unique symbols in RatingChanges collection exist in Stocks collection
        var _uniqStocks = _.uniq(_.pluck(Stocks.find({}, {fields: {_id: 1}}).fetch(), "_id"));

        var _symbolsNotInStocksCollection = _.difference(_uniqRatingChangesSymbols, _uniqStocks);

        var _thisArrShouldBeEmpty = [];
        _.each(_symbolsNotInStocksCollection, function (symbol) {
            // look up each symbol in symbol mapping collection. if it's not there with "rating_changes" flag, then
            // push to _thisArrShouldBeEmpty

            var _symbolMapping = SymbolMappings.findOne({
                "symbolStr" : symbol,
                "from" : "rating_change"
            });
            if (_symbolMapping) {
                // do nothing
            } else {
                _thisArrShouldBeEmpty.push({
                    symbol: symbol,
                    ratingChangesDates: _.pluck(RatingChanges.find({symbol: symbol}, {fields: {dateString: 1}}).fetch(), "dateString")
                });
            }
        });

        return _thisArrShouldBeEmpty;
    }

    , getRatingChangeHistoryForSymbolAndFirm(symbol, firmName) {
        var _firm = ResearchCompanies.find({name: firmName}).fetch();
        if (_firm.length === 1) {
            var _firmId = _firm[0]._id;
            var _ratingChanges = RatingChanges.find({symbol: symbol, researchFirmId: _firmId}, {sort: {dateString: 1}}).fetch();
            _.each(_ratingChanges, function (rCh) {
                console.log("date: ", rCh.dateString);
                console.log("old: ", RatingScales.findOne(rCh.oldRatingId).universalScaleValue);
                console.log("new: ", RatingScales.findOne(rCh.newRatingId).universalScaleValue);
                console.log("--------------------------------------");
            })
        } else {
            console.log("cannot find the needed firm: ", _firm);
        }
    }
    
    , insertNewRollingPortfolioItem: function (obj) {
        // check that the symbol exists
        var _p = Portfolios.findOne(obj.portfolioId);
        if (!_p || !_p.rolling) {
            throw new Meteor.Error("portfolio does not exist or it is not rolling!");
        }

        if (!Stocks.findOne(obj.symbol)) {
            throw new Meteor.Error("symbol does not exist!");
        } else {
            // check if such portfolio item already exists for that date and symbol
            var _existingPortfolioItem = PortfolioItems.findOne({symbol: obj.symbol, portfolioId: obj.portfolioId, dateString: obj.dateString});
            if (_existingPortfolioItem) {
                throw new Meteor.Error("portfolio item already exists!");
            } else {
                if (isNaN((new Date(obj.dateString)).valueOf())) {
                    throw new Meteor.Error("date is not valid!");
                } else {
                    var _user = Meteor.user();
                    if (!_user) {
                        throw new Meteor.Error("Please log in to import portfolio items.");
                    } else {
                        var _dataImportPermissions = _user.permissions && _user.permissions.dataImports;
                        var _canImportPortfolioItems = _dataImportPermissions && _dataImportPermissions.indexOf("canImportPortfolioItems") > -1;
                        if (!_canImportPortfolioItems) {
                            throw new Meteor.Error("You do not have permission to import portfolio items.");
                        }
                    }

                    PortfolioItems.insert({
                        symbol: obj.symbol,
                        portfolioId: obj.portfolioId,
                        dateString: obj.dateString,
                        short: obj.short
                    })
                }
            }
        }
    }
})

// inner futures link: http://stackoverflow.com/questions/25940806/meteor-synchronizing-multiple-async-queries-before-returning

if (Meteor.isServer) {
    Meteor.publish("earningsReleases", function (startDate, endDate, companyConfirmedOnly) {

        var _query = {
            reportDateNextFiscalQuarter: {
                $gte: startDate, $lte: endDate,
            }
        };

        if (companyConfirmedOnly) {
            _query = _.extend(_query, {
                reportSourceFlag: 1
            });
        };

        var _allEarningsReleases = EarningsReleases.find(_query, {sort: {reportSourceFlag: 1, reportDateNextFiscalQuarter: 1, asOf: -1}});

        return _allEarningsReleases;
    });

    Meteor.publish("portfolios", function() {
        if (this.userId) {
            // TODO: add logic here to also return portfolios that you have either view or edit access in PortfolioPermissions collection
            //portfolios that are either public or the user is owner
            return Portfolios.find(
                { $or: [ {private: false}, {ownerId: this.userId} ] },
                {fields: {_id: 1, name: 1, researchFirmId: 1, ownerId: 1, private: 1}}
                );
        } else {
            return Portfolios.find({private: false}, {fields: {_id: 1, name: 1}});
        }
    });

    Meteor.publish(null, function() {
        var _user = this.userId ? Meteor.users.find({_id: this.userId}, {fields: {_id: 1, username: 1, individualStocksAccess: 1, registered: 1, lastModified: 1, showDataImportsTab: 1}}) : null;
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
        _createdUser.permissions = {};
        _createdUser.showDataImportsTab = false;

        return _createdUser;
    })

    Meteor.methods({

        registerRealAccountFromDummy: function(newUsername, newPassword) {
            var dummyUserId = Meteor.userId();
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
        createNewPortfolio: function (name) {
            // Make sure the user is logged in before inserting a portfolio
            if (! Meteor.userId()) {
                throw new Meteor.Error("not-authorized");
            }

            Portfolios.insert({
                name: name,
                private: false,
                ownerId: Meteor.userId(),
                researchFirmId: null,
                lastModifiedOn: moment().toISOString(),
                lastModifiedBy: Meteor.userId(),
                ownerName: Meteor.user().username
            });
        },
        removeStockFromPickList: function(pickListItemId, dateRemoved) {
            var _pickListItem = PickListItems.findOne(pickListItemId);
            if (_pickListItem && !_pickListItem.dateRemoved) {
                PickListItems.update({_id: pickListItemId}, {$set: {dateRemoved: dateRemoved}})
            }
        },
        removePickListItem: function(pickListItemId) {
            PickListItems.remove(pickListItemId);
        },

        checkIfSymbolExists: function (symbol) {
            var _wikiUrl = getWikiPricesQuandlUrl(false, [symbol]);
            var _nasdaqUrl = getNasdaqPricesQuandlUrl(symbol);

            function _checkWiki() {
                try {
                    var _res = HTTP.get(_wikiUrl);
                    if (_res.data.datatable.data.length > 0) {
                        return true;
                    } else {
                        return false;
                    }
                } catch (e) {
                    return false;
                }
            };

            function _checkNasdaq() {
                try {
                    var _res = HTTP.get(_nasdaqUrl);
                    return true;
                } catch (e) {
                    return false;
                }
            }

            return _checkWiki() || _checkNasdaq();
        },

        insertNewStockSymbols: function(symbolsArray) {
            var _res = {};
            var _symbolsAllCapsArray = [];
            symbolsArray.forEach(function(symbol) {
                _symbolsAllCapsArray.push(symbol.toUpperCase());
            });

            _.each(_symbolsAllCapsArray, function (s) {
                if (Stocks.findOne({_id: s})) {
                    _res[s] = true;
                } else {
                    Meteor.call("checkIfSymbolExists", s, function (error, result) {
                        if (result) {
                            Stocks.insert({_id: s});
                            _res[s] = true;
                        } else {
                            _res[s] = false;
                        }
                    })
                }
            });

            return _res;
        },

        getQuandlPricesForDate: function (dateStrYYYY_MM_DD, optionalSymbolsArr, optionalOverWriteFlag) {

            var _res;
            var res = HTTP.get(getWikiPricesQuandlUrl(dateStrYYYY_MM_DD, optionalSymbolsArr));
                if (res) {
                    var _data = res.data.datatable.data;
                    var _columnDefs = res.data.datatable.columns;

                    var _getStockPricesFromYahooFinanceResults = [];
                    _.each(_data, function (item, itemIdx) {
                            var _priceObj = {};
                            _.each(_columnDefs, function (columnDefObj, columnDefItemIndex) {
                                var _val = item[columnDefItemIndex];
                                _priceObj[columnDefObj["name"]] = _val;
                            })

                            var _formattedPriceObj = {
                                "date" : new Date(_priceObj.date + "T00:00:00.000+0000"),
                                "open" : _priceObj.open,
                                "high" : _priceObj.high,
                                "low" : _priceObj.low,
                                "close" : _priceObj.close,
                                "volume" : _priceObj.volume,
                                "exDividend": _priceObj["ex-dividend"],
                                splitRatio: _priceObj.split_ratio,
                                adjOpen: _priceObj.adj_open,
                                adjHigh: _priceObj.adj_high,
                                adjLow: _priceObj.adj_low,
                                "adjClose" : _priceObj.adj_close,
                                adjVolume: _priceObj.adj_volume,
                                "symbol" : _priceObj.ticker,
                                "dateString" : _priceObj.date,
                                source: "quandl_free",
                                importedBy: Meteor.userId(),
                                importedOn: new Date().toISOString()
                            };
                            if (optionalOverWriteFlag) {
                                // remove existing object if there's already a price for that date and symbol from
                                // quandl_paid, even if there's an adjClose that came from processSplits
                                var _obj = NewStockPrices.findOne({source: "quandl_paid", symbol: _formattedPriceObj.symbol, dateString: _formattedPriceObj.dateString});
                                if (_obj) {
                                    console.log("removing this price obj _id: ", _obj._id);
                                    NewStockPrices.remove({_id: _obj._id});
                                }
                            };

                            Meteor.call("stockPriceInsertAttempt", _formattedPriceObj, function (error, result) {
                                if (error) {
                                    _getStockPricesFromYahooFinanceResults.push(error);
                                } else {
                                    _getStockPricesFromYahooFinanceResults.push(result);
                                }
                            })
                    })

                    _res = _getStockPricesFromYahooFinanceResults;
                }
        },

        processSplits: function (symbolsArr) {
            console.log(symbolsArr.length);

            _.each(symbolsArr, function (symbol) {
                try {
                    var _res = Meteor.call("getNASDAQquandlStockPrices", symbol);
                    console.log("the length of result: ", _res.length, symbol);
                    var _sortedDates = _.sortBy(_.pluck(_res, "dateString"), function (dateStr) { return dateStr; });
                    var _maxResultDate = _sortedDates[_sortedDates.length - 1];
                    var _minResultDate = _sortedDates[0];


                    var _filteredRes = _.filter(_res, function (obj) {
                        // exclude cash dividends adjType -- code is 17
                        return (!_.isNull(obj.adjFactor) || !_.isNull(obj.adjType)) && !_.contains([17], obj.adjType)
                    })


                    var _secondOption = false;
                    if (_filteredRes.length === 1) {
                        var _split = _filteredRes[0];
                        // add 1 year to recorded split date because it takes time for the split to take effect
                        var _splitDate = moment(_split.dateString).add(1, "years").format("YYYY-MM-DD");
                        console.log("only one split found for: ", symbol, _splitDate);

                        // make sure the split happened before any prices in the db
                        var _pricesBeforeSplit = NewStockPrices.find({
                            symbol: symbol, dateString: { $lte: _splitDate }
                        }).fetch();
                        if (_pricesBeforeSplit.length === 0) {
                            console.log("all db prices are AFTER the split");
                            _secondOption = true;
                        } else {
                            console.log("there are some db prices BEFORE the split");
                        }
                    }


                    if (_filteredRes.length === 0 || _secondOption) {
                        console.log("no splits OR an irrelevant split found for ", symbol);
                        console.log("min and max dates available from result: ", _minResultDate, _maxResultDate);
                        var _pricesWithMissingAdjClose = NewStockPrices.find({
                            symbol: symbol,
                            adjClose: {$exists: false},
                            $and: [
                                {dateString: {$gte: _minResultDate}},
                                {dateString: {$lte: _maxResultDate}},
                                {adjFactor: {$exists: true}},
                                {adjType: {$exists: true}}
                            ]
                        }).fetch();
                        console.log("length of prices with missing adjClose param: ", _pricesWithMissingAdjClose.length);
                        _.each(_pricesWithMissingAdjClose, function (missingAdjClosePriceObj) {
                            var _id = missingAdjClosePriceObj._id;
                            var _close = missingAdjClosePriceObj.close;
                            console.log(_id, _close);
                            NewStockPrices.update({ _id: _id }, { $set: { adjClose: _close } })
                        })
                    } else {
                        console.log("there are splits for: ", symbol)
                    }


                } catch (e) {

                }
                console.log("--------------");
            });
            console.log("gonna return response");

            return "done";
        },
        // getAllUniqSymbols: function () {
        //     return _.uniq(_.pluck(Stocks.find({}, {fields: {_id: 1}}).fetch(), "_id"));
        // },

        getLatestPricesForAllSymbols: function(defaultStartDate, _latestDateString) {
            // defaultStartDate like "2014-01-01"


            var _pastDate = defaultStartDate;

// either maxRequestedEndDate does not exist or it is less than latest market close date
            var _uniqSym = _.uniq(_.pluck(Stocks.find({$or: [  {maxRequestedEndDate: {$exists: false}  }, {   maxRequestedEndDate: {$lt: _latestDateString}  } ]}, {fields: {_id: 1}}).fetch(), "_id"));

            _.each(_uniqSym, function (symbol) {
                console.log("symbol: ", symbol);

                var _existingEndDate = NewStockPrices.findOne({symbol: symbol}, {sort: {dateString: -1}});
                if (_existingEndDate) {
                    _existingEndDate = _existingEndDate.dateString;
                    console.log("end date: ", _existingEndDate)
                } else {
                    console.log("end date does not exist");
                }

                var startStr = _pastDate;
                if (_existingEndDate) {
                    startStr = _existingEndDate;
                };
                var endStr = _latestDateString;

                console.log("gonna request from yahoo finance: ", startStr, endStr);

                var _res;
                Meteor.call("getNASDAQquandlStockPrices", symbol, startStr, endStr, function (error, result) {
                    if (!error && result) {
                        console.log("got a result from Yahoo Finance. the length of result is: ", result.length);
                        // inner futures link: http://stackoverflow.com/questions/25940806/meteor-synchronizing-multiple-async-queries-before-returning

                        var _getStockPricesFromYahooFinanceResults = [];
                        result.forEach(function (priceObj) {

                            Meteor.call('stockPriceInsertAttempt', priceObj, function (error, result) {
                                if (error) {
                                    _getStockPricesFromYahooFinanceResults.push(error);
                                } else {
                                    _getStockPricesFromYahooFinanceResults.push(result);
                                }
                            })
                        });

                        _res = _getStockPricesFromYahooFinanceResults;


                        Stocks.update(
                            {_id: symbol},
                            {$set: {maxRequestedEndDate: endStr}}
                        );

                        if (!_existingEndDate) {
                            Stocks.update(
                                {_id: symbol},
                                {$set: {minRequestedStartDate: startStr}}
                            );
                        }
                    }
                });

                console.log("------------------------------------------");
            });
        }
    });
}