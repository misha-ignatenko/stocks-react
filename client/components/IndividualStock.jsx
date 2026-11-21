import React, { useState } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { Meteor } from "meteor/meteor";

import AverageAndWeightedRatings from "./Ratings/AverageAndWeightedRatings.jsx";

function IndividualStock() {
    const [individualStockStartDate, setIndividualStockStartDate] =
        useState(null);
    const [individualStockEndDate, setIndividualStockEndDate] = useState(null);
    const [selectedStock, setSelectedStock] = useState(null);
    const [stocksToGraphObjects, setStocksToGraphObjects] = useState([]);
    const [showAvgRatings, setShowAvgRatings] = useState(true);
    const [showWeightedRating, setShowWeightedRating] = useState(true);
    const [searchValue, setSearchValue] = useState("");

    const userId = useTracker(() => Meteor.userId(), []);

    const searchingStock = (e) => {
        setSearchValue(e.target.value.toUpperCase());
    };

    const clearSelectedStock = () => {
        setSelectedStock(null);
        setSearchValue("");
    };

    const resetDateRange = () => {
        setIndividualStockStartDate(null);
        setIndividualStockEndDate(null);
    };

    const selectFirstSearchResult = async (event) => {
        if (event.keyCode === 13) {
            const symbol = searchValue;
            try {
                const res = await Meteor.callAsync("insertNewStockSymbols", [
                    symbol,
                ]);
                if (res[symbol]) {
                    setSelectedStock(symbol);
                } else {
                    console.log("the symbol is invalid: ", symbol);
                    clearSelectedStock();
                }
            } catch (err) {
                console.error("Error inserting stock symbol:", err);
                clearSelectedStock();
            }
        }
    };

    const selectTab = (tabId) => {
        setShowAvgRatings(tabId !== "wgt");
        setShowWeightedRating(tabId !== "avg");
    };

    if (!userId) {
        return (
            <div className="container">
                You must be logged in to view this page.
            </div>
        );
    }

    const _b = "btn btn-light";
    const _ab = "btn btn-light active";

    return (
        <div className="container">
            <br />
            <br />
            search for:
            <input
                className="individualStockSearch"
                value={searchValue}
                onChange={searchingStock}
                onKeyDown={selectFirstSearchResult}
                placeholder="Enter stock symbol"
            />
            <br />
            {selectedStock && (
                <div>
                    selected stock: {selectedStock}
                    <button onClick={clearSelectedStock}>Clear</button>
                </div>
            )}
            <div className="btn-group" role="group" aria-label="...">
                <button
                    type="button"
                    className={showAvgRatings && !showWeightedRating ? _ab : _b}
                    onClick={() => selectTab("avg")}
                >
                    avg only
                </button>
                <button
                    type="button"
                    className={showAvgRatings && showWeightedRating ? _ab : _b}
                    onClick={() => selectTab("both")}
                >
                    both
                </button>
                <button
                    type="button"
                    className={!showAvgRatings && showWeightedRating ? _ab : _b}
                    onClick={() => selectTab("wgt")}
                >
                    wgt only
                </button>
            </div>
            {(individualStockStartDate || individualStockEndDate) && (
                <div>
                    <button onClick={resetDateRange}>Reset date range</button>
                </div>
            )}
            {individualStockStartDate}
            {individualStockEndDate}
            {selectedStock &&
                individualStockStartDate &&
                individualStockEndDate && (
                    <div>
                        <br />
                        <br />
                        <h1>Details for {selectedStock}</h1>
                        <div className="col-md-12 individualStockGraph">
                            <StocksGraph
                                stocksToGraphObjects={stocksToGraphObjects}
                            />
                        </div>
                    </div>
                )}
            {selectedStock && (
                <div className="container">
                    <AverageAndWeightedRatings
                        earningsReleases={[]}
                        symbol={selectedStock}
                        showAvgRatings={showAvgRatings}
                        showWeightedRating={showWeightedRating}
                    />
                </div>
            )}
        </div>
    );
}

export default IndividualStock;
