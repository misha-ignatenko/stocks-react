/**
 * Created by mykhayloignatenko on 4/2/18.
 */
StocksReactServerUtils = {

    apiKey: function () {
        return Settings.findOne({type: "main"}, {fields: {'dataImports.earningsReleases.quandlZeaAuthToken': 1}}).dataImports.earningsReleases.quandlZeaAuthToken;
    },

    prices: {

        // FREE
        getWikiPricesQuandlUrl: function (dateStrYYYY_MM_DD, optionalSymbolsArr) {
            var _quandlFreeBaseUrl = "https://www.quandl.com/api/v3/datatables/WIKI/PRICES.json";
            var _apiKey = StocksReactServerUtils.apiKey();
            if (dateStrYYYY_MM_DD && optionalSymbolsArr) {
                var _url = _quandlFreeBaseUrl + "?date=" +
                    (typeof dateStrYYYY_MM_DD === "string" ? dateStrYYYY_MM_DD : dateStrYYYY_MM_DD.join()).replace(/-/g, '') + "&ticker=" + optionalSymbolsArr.join() + "&api_key=" +
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
        },

        // PAID
        getNasdaqPricesQuandlUrl: function (symbol, startDate, endDate) {
            var _url = "https://www.quandl.com/api/v3/datasets/XNAS/" + symbol + ".json?" +
                (startDate ? ("start_date=" + startDate + "&") : "") +
                (endDate ? ("end_date=" + endDate + "&") : "") +
                "api_key=" + StocksReactServerUtils.apiKey();

            return _url;
        },

        getFormattedPriceObjWiki: function (item, _columnDefs) {
            var _priceObj = {};
            _.each(_columnDefs, function (columnDefObj, columnDefItemIndex) {
                var _val = item[columnDefItemIndex];
                _priceObj[columnDefObj["name"]] = _val;
            })

            var _formattedPriceObj = {
                "date": new Date(_priceObj.date + "T00:00:00.000+0000"),
                "open": _priceObj.open,
                "high": _priceObj.high,
                "low": _priceObj.low,
                "close": _priceObj.close,
                "volume": _priceObj.volume,
                "exDividend": _priceObj["ex-dividend"],
                splitRatio: _priceObj.split_ratio,
                adjOpen: _priceObj.adj_open,
                adjHigh: _priceObj.adj_high,
                adjLow: _priceObj.adj_low,
                "adjClose": _priceObj.adj_close,
                adjVolume: _priceObj.adj_volume,
                "symbol": _priceObj.ticker,
                "dateString": _priceObj.date,
                source: "quandl_free",
                importedBy: Meteor.userId(),
                importedOn: new Date().toISOString()
            };

            return _formattedPriceObj;
        },

        getFormattedPriceObjNasdaq: function (_columnNames, obj, symbol) {
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

            // 17 = dividend
            if (!_convertedObj.adjFactor || _convertedObj.adjType === 17) {
                _convertedObj.adjClose = _convertedObj.close;
            } else {
                console.log('ADJUSTMENT: ', symbol, _processedItem);
            }

            return _convertedObj;
        },


        getAllPrices: function (symbol) {
            console.log("inside getPricesForSymbol: ", symbol);
            var _prices = [];

            // try Nasdaq first
            var _nasdaqUrl = StocksReactServerUtils.prices.getNasdaqPricesQuandlUrl(symbol);
            try {
                var _res = HTTP.get(_nasdaqUrl);
                var _dataset = _res.data.dataset;
                var _unprocessedPrices = _dataset.data;
                var _columnNames = _.map(_dataset.column_names, function (rawColName) {
                    return rawColName.replace(/ /g, "_");
                });

                _.each(_unprocessedPrices, function (obj, idx) {
                    // check that all column names are present
                    if (_columnNames.length === obj.length && _columnNames.length === 8) {
                        var _convertedObj = StocksReactServerUtils.prices.getFormattedPriceObjNasdaq(_columnNames, obj, symbol);
                        _prices.push({symbol: _convertedObj.symbol, dateString: _convertedObj.dateString, adjClose: _convertedObj.close, date: _convertedObj.date});
                    } else {
                        throw new Meteor.Error("missing keys for NASDAQ data import: ", symbol);
                    }
                })

            } catch (e) {
                console.log("ERROR: ", e);
            }

            if (_prices.length === 0) {
                var _wikiUrl = StocksReactServerUtils.prices.getWikiPricesQuandlUrl(false, [symbol]);
                try {
                    var _res = HTTP.get(_wikiUrl);
                    var _datatable = _res.data.datatable;
                    _.each(_datatable.data, function (px) {
                        var _formatted = StocksReactServerUtils.prices.getFormattedPriceObjWiki(px, _datatable.columns);
                        _prices.push({symbol: _formatted.symbol, dateString: _formatted.dateString, adjClose: _formatted.adjClose, date: _formatted.date});
                    })

                } catch (e) {
                    console.log("ERROR: ", e);
                }
            }

            return _prices;
        },
    },
    earningsReleases: {
        getZeaUrl: function (symbol) {
            var _url = "https://www.quandl.com/api/v3/datasets/ZEA/" + symbol + ".json?auth_token=" + StocksReactServerUtils.apiKey();
            return _url;
        }
    }
};