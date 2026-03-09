import React, { useState, useEffect } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { Meteor } from "meteor/meteor";
import { NavLink } from "react-router-dom";
import { Table } from "reactstrap";
import { Utils } from "../../lib/utils";

const TIME_OF_DAY_MAP = { 1: "After market close", 2: "Before the open", 3: "During market trading", 4: "Unknown" };

export const UpcomingEarningsReleases = () => {
    const [earningsReleases, setEarningsReleases] = useState(null);
    const [finnhubReleases, setFinnhubReleases] = useState(null);
    const [nasdaqReleases, setNasdaqReleases] = useState(null);

    const { user, loggingIn } = useTracker(() => ({
        user: Meteor.user({ fields: { registered: 1 } }),
        loggingIn: Meteor.loggingIn(),
    }), []);

    useEffect(() => {
        if (loggingIn) return;
        setEarningsReleases(null);
        setFinnhubReleases(null);
        setNasdaqReleases(null);
        Meteor.call("getUpcomingEarningsReleases", (err, res) => {
            if (!err) setEarningsReleases(res);
        });
        Meteor.call("getUpcomingEarningsReleasesFinnhub", (err, res) => {
            if (!err) setFinnhubReleases(res);
        });
        Meteor.call("getUpcomingEarningsReleasesNasdaq", (err, res) => {
            if (!err) setNasdaqReleases(res);
        });
    }, [user, loggingIn]);

    return (
        <div>
            {earningsReleases === null ? (
                "getting upcoming earnings releases."
            ) : earningsReleases.length ? (
                <div>
                    <button
                        type="button"
                        className="btn btn-light"
                        onClick={() => Utils.download_table_as_csv("upcomingEarningsReleases")}
                    >
                        Export as a CSV
                    </button>
                    {" "}
                    <NavLink to="/contact">Contact Us</NavLink>
                    <br />
                    <br />
                    <Table id="upcomingEarningsReleases" bordered>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Time of Day</th>
                                <th>Symbol</th>
                            </tr>
                        </thead>
                        <tbody>
                            {earningsReleases.map((e) => (
                                <tr key={e.key}>
                                    <td>{e.reportDateNextFiscalQuarter}</td>
                                    <td>{e.timeOfDay}</td>
                                    <td>{e.symbol}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            ) : (
                <h3>there are no earnings releases.</h3>
            )}

            <hr />
            <h4>Finnhub (monitoring)</h4>
            {finnhubReleases === null ? (
                "getting finnhub earnings releases."
            ) : finnhubReleases.length ? (
                <div>
                    <button
                        type="button"
                        className="btn btn-light"
                        onClick={() => Utils.download_table_as_csv("upcomingEarningsReleasesFinnhub")}
                    >
                        Export as a CSV
                    </button>
                    <br />
                    <br />
                    <Table id="upcomingEarningsReleasesFinnhub" bordered>
                        <thead>
                            <tr>
                                <th>Symbol</th>
                                <th>Report Date</th>
                                <th>Time of Day</th>
                                <th>EPS Est.</th>
                                <th>Quarter</th>
                                <th>Year</th>
                                <th>As Of</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finnhubReleases.map((e) => (
                                <tr key={`${e.reportDateNextFiscalQuarter}-${e.symbol}`}>
                                    <td>{e.symbol}</td>
                                    <td>{e.reportDateNextFiscalQuarter}</td>
                                    <td>{TIME_OF_DAY_MAP[e.reportTimeOfDayCode] ?? ""}</td>
                                    <td>{e.epsMeanEstimateNextFiscalQuarter ?? ""}</td>
                                    <td>{e.quarter ?? ""}</td>
                                    <td>{e.year ?? ""}</td>
                                    <td>{e.asOf}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            ) : (
                <h3>there are no finnhub earnings releases.</h3>
            )}

            <hr />
            <h4>Nasdaq (monitoring)</h4>
            {nasdaqReleases === null ? (
                "getting nasdaq earnings releases."
            ) : nasdaqReleases.length ? (
                <div>
                    <button
                        type="button"
                        className="btn btn-light"
                        onClick={() => Utils.download_table_as_csv("upcomingEarningsReleasesNasdaq")}
                    >
                        Export as a CSV
                    </button>
                    <br />
                    <br />
                    <Table id="upcomingEarningsReleasesNasdaq" bordered>
                        <thead>
                            <tr>
                                <th>Symbol</th>
                                <th>Name</th>
                                <th>Report Date</th>
                                <th>Time of Day</th>
                                <th>EPS Est.</th>
                                <th># Ests</th>
                                <th>Quarter</th>
                                <th>Year</th>
                                <th>As Of</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nasdaqReleases.map((e) => (
                                <tr key={`${e.reportDateNextFiscalQuarter}-${e.symbol}`}>
                                    <td>{e.symbol}</td>
                                    <td>{e.name ?? ""}</td>
                                    <td>{e.reportDateNextFiscalQuarter}</td>
                                    <td>{TIME_OF_DAY_MAP[e.reportTimeOfDayCode] ?? ""}</td>
                                    <td>{e.epsMeanEstimateNextFiscalQuarter ?? ""}</td>
                                    <td>{e.numEstimates ?? ""}</td>
                                    <td>{e.quarter ?? ""}</td>
                                    <td>{e.year ?? ""}</td>
                                    <td>{e.asOf}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            ) : (
                <h3>there are no nasdaq earnings releases.</h3>
            )}
        </div>
    );
};
