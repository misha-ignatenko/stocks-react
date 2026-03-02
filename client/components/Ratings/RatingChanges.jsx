import React, { useState, useEffect, useCallback } from "react";
import _ from "underscore";
import { NavLink } from "react-router-dom";
import { Table } from "reactstrap";
import { Meteor } from "meteor/meteor";
import { Utils } from "../../../lib/utils";

const ALL_MODE = "all";
const SYMBOL_MODE = "symbol";

function RatingChanges() {
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState(ALL_MODE);
    const [symbol, setSymbol] = useState(undefined);
    const [ratingChanges, setRatingChanges] = useState([]);
    const [symbolSearch, setSymbolSearch] = useState("");
    const [symbolSearchResults, setSymbolSearchResults] = useState([]);
    const [numChanges, setNumChanges] = useState(0);
    const [numFirms, setNumFirms] = useState(0);

    const loadRatingChanges = useCallback((currentMode, currentSymbol) => {
        const isAllMode = currentMode === ALL_MODE;
        if (isAllMode) {
            setLoading(true);
            Meteor.call("getLatestRatingChanges", (err, res) => {
                if (!err) {
                    setLoading(false);
                    setRatingChanges(res);
                }
            });
        } else {
            if (currentSymbol) {
                setLoading(true);
                Meteor.call(
                    "getLatestRatingChangesForSymbol",
                    currentSymbol,
                    (err, res) => {
                        if (!err) {
                            setLoading(false);
                            setRatingChanges(res);
                        }
                    },
                );
            }
        }
    }, []);

    // Debounced symbol search
    const onSymbolInput = useCallback(
        _.debounce(() => {
            if (!symbolSearch) return;

            Meteor.call("getSimilarSymbols", symbolSearch, (err, results) => {
                if (!err) setSymbolSearchResults(results);
            });
        }, 1000),
        [symbolSearch],
    );

    const onSymbolInputChange = (event) => {
        setSymbolSearch(event.target.value);
    };

    const handleSetMode = (event) => {
        const newMode = event.target.value;
        if (newMode !== mode) {
            if (newMode === SYMBOL_MODE) {
                setMode(SYMBOL_MODE);
                setRatingChanges([]);
            } else {
                setMode(ALL_MODE);
                setSymbol(undefined);
                setRatingChanges([]);
            }
            loadRatingChanges(newMode);
        }
    };

    const setSelectedSymbol = (selectedSymbol) => {
        setSymbol(selectedSymbol);
        setSymbolSearchResults([]);
        loadRatingChanges(SYMBOL_MODE, selectedSymbol);
    };

    const exportCSV = () => {
        Utils.download_table_as_csv("ratingChanges");
    };

    const renderSearchResults = () => {
        return symbolSearchResults.map((sym) => (
            <button
                type="button"
                className="btn btn-light"
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
            >
                {sym}
            </button>
        ));
    };

    // Initial load
    useEffect(() => {
        const loadInitialData = async () => {
            const stats = await Meteor.callAsync("getRatingChangeMetadata");
            setNumChanges(stats.numChanges);
            setNumFirms(stats.numFirms);
            loadRatingChanges(ALL_MODE);
        };

        loadInitialData();
    }, [loadRatingChanges]);

    const _b = "btn btn-light";
    const _ab = "btn btn-light active";
    const isSymbolMode = mode === SYMBOL_MODE;

    return (
        <div>
            <br />
            <div>
                <div className="container">
                    <div className="btn-group" role="group" aria-label="...">
                        <button
                            type="button"
                            className={mode === ALL_MODE ? _ab : _b}
                            value={ALL_MODE}
                            onClick={handleSetMode}
                        >
                            All symbols
                        </button>
                        <button
                            type="button"
                            className={mode === SYMBOL_MODE ? _ab : _b}
                            value={SYMBOL_MODE}
                            onClick={handleSetMode}
                        >
                            Specific Symbol
                        </button>
                    </div>
                    <br />
                    {loading ? (
                        <div>Loading...</div>
                    ) : (
                        <div>
                            {isSymbolMode && (
                                <div>
                                    <input
                                        className="individualStockSearch"
                                        id="individualStockSearch"
                                        onKeyDown={onSymbolInput}
                                        onChange={onSymbolInputChange}
                                    />
                                    <div id="individualStockSearchResults">
                                        {renderSearchResults()}
                                    </div>
                                    {symbol && (
                                        <div>Selected symbol: {symbol}</div>
                                    )}
                                </div>
                            )}
                            Displaying {ratingChanges.length} rating changes
                            within the last {Utils.ratingChangesLookbackMonths}{" "}
                            months{" "}
                            <button
                                type="button"
                                className={_b}
                                onClick={exportCSV}
                            >
                                Export as a CSV
                            </button>
                            <br />
                            To view more (<b>{numChanges}</b> rating changes
                            across <b>{numFirms}</b> analyst firms),{" "}
                            <NavLink to="/contact">Contact Us</NavLink>
                            <br />
                            <br />
                            <Table id="ratingChanges" bordered>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Symbol</th>
                                        <th>Research Firm</th>
                                        <th>Old Rating</th>
                                        <th>New Rating</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {ratingChanges.map((row) => {
                                        const {
                                            dateString,
                                            symbol: rowSymbol,
                                            researchFirmName,
                                            oldRating,
                                            newRating,
                                        } = row;
                                        const rowKey =
                                            dateString +
                                            rowSymbol +
                                            researchFirmName;

                                        return (
                                            <tr key={rowKey}>
                                                <td>{dateString}</td>
                                                <td>{rowSymbol}</td>
                                                <td>{researchFirmName}</td>
                                                <td>{oldRating}</td>
                                                <td>{newRating}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RatingChanges;
