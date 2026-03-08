import React, { useState, useEffect } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { Meteor } from "meteor/meteor";
import { NavLink } from "react-router-dom";
import { Table } from "reactstrap";
import { Utils } from "../../lib/utils";

export const UpcomingEarningsReleases = () => {
    const [earningsReleases, setEarningsReleases] = useState(null);

    const user = useTracker(
        () => Meteor.user({ fields: { registered: 1 } }),
        [],
    );

    useEffect(() => {
        setEarningsReleases(null);
        Meteor.call("getUpcomingEarningsReleases", (err, res) => {
            if (!err) setEarningsReleases(res);
        });
    }, [user]);

    const exportCSV = () => {
        Utils.download_table_as_csv("upcomingEarningsReleases");
    };

    if (earningsReleases === null) return "getting upcoming earnings releases.";

    return (
        <div>
            {earningsReleases.length ? (
                <div>
                    <button
                        type="button"
                        className="btn btn-light"
                        onClick={exportCSV}
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
        </div>
    );
};
