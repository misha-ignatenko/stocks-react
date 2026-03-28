import React, { useState } from "react";
import { useTracker } from "meteor/react-meteor-data";
import { Meteor } from "meteor/meteor";
import _ from "underscore";
import toast, { Toaster } from "react-hot-toast";

function UpDownGradesJSONDataImport() {
    const [sourceChoices] = useState(["f", "b", "s", "other"]);
    const [selectedSource, setSelectedSource] = useState("");
    const [textAreaValue, setTextAreaValue] = useState("");
    const [splitIntoCells, setSplitIntoCells] = useState(false);
    const [cellValues, setCellValues] = useState([]);

    const { currentUser } = useTracker(
        () => ({
            currentUser: Meteor.user(),
        }),
        [],
    );

    const handleChange = (event) => {
        const textAreaNewValue = event.target.value;
        const allLines = textAreaNewValue.split("\n");
        const splitByTabsAndNewLines = allLines.map((line) => line.split("\t"));

        const parsed = [];
        if (splitByTabsAndNewLines.length > 0) {
            const keys = splitByTabsAndNewLines[0];
            // Remove keys row
            const dataRows = splitByTabsAndNewLines.slice(1);

            dataRows.forEach((dataArr) => {
                const everyItemInDataArrIsNonBlank = dataArr.every(
                    (val) => val !== "",
                );

                if (everyItemInDataArrIsNonBlank) {
                    const row = {};
                    keys.forEach((key, index) => {
                        row[key] = dataArr[index];
                    });
                    parsed.push(row);
                }
            });
        }

        if (parsed.length > 0) {
            const firstObj = parsed[0];
            const keys = Object.keys(firstObj);

            // Validate all objects have required fields
            const problems = [];
            parsed.forEach((obj, index) => {
                keys.forEach((key) => {
                    if (!obj[key]) {
                        problems.push({ index, key });
                    }
                });
            });

            if (problems.length > 0) {
                console.log("problems: ", problems);
                toast.error(`Missing fields: ${JSON.stringify(problems)}`);
            } else {
                setSplitIntoCells(true);
                setCellValues(parsed);
            }
        }

        setTextAreaValue(textAreaNewValue);
    };

    const verifyAndImportUpDownGradesJSONData = () => {
        let parsed = cellValues.map((importItem) => ({
            ...importItem,
            source: selectedSource,
        }));

        clearCells();

        const closableToast = (fn, message) =>
            fn(
                (t) => (
                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        {message}
                        <button onClick={() => toast.dismiss(t.id)}>✕</button>
                    </span>
                ),
                { duration: 60 * 60 * 1000 },
            );

        Meteor.call(
            "importData",
            parsed,
            "upgrades_downgrades",
            (error, result) => {
                if (error) {
                    closableToast(
                        toast.error,
                        `Import failed: ${error.message}`,
                    );
                } else if (
                    result.couldNotFindGradingScalesForTheseUpDowngrades
                        ?.length > 0
                ) {
                    closableToast(
                        toast.error,
                        `Missing Rating Scales for the following: ${JSON.stringify(result)}`,
                    );
                } else if (result.upgradesDowngradesImportStats) {
                    const importStats = result.upgradesDowngradesImportStats;
                    closableToast(
                        toast.success,
                        `Imported stats\nNew: ${importStats.new}\nDuplicates: ${importStats.duplicates}\nOut of: ${importStats.total}\nDates: ${JSON.stringify(result.importedDatesStr)}`,
                    );
                }
            },
        );
    };

    const handleIndividualCellChange = (index, key, value) => {
        const updatedCellValues = [...cellValues];
        updatedCellValues[index][key] = value;
        setCellValues(updatedCellValues);
    };

    const renderCells = () => {
        if (cellValues.length === 0) return null;

        const firstObj = cellValues[0];
        const keys = Object.keys(firstObj);

        return (
            <div>
                <div className="row">
                    {keys.map((key) => {
                        const keyId = key.replace(/ /g, "_");
                        return (
                            <div className="col-md-2" key={keyId}>
                                <span>{key}</span>
                            </div>
                        );
                    })}
                </div>

                {cellValues.map((cellValue, index) => (
                    <div className="row" key={index}>
                        {keys.map((key) => {
                            const val = cellValue[key];
                            const cellKey = `${index}_${key}`;

                            return (
                                <div className="col-md-2" key={cellKey}>
                                    <input
                                        className="simpleInput"
                                        value={val}
                                        onChange={(e) =>
                                            handleIndividualCellChange(
                                                index,
                                                key,
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                            );
                        })}
                        <br />
                    </div>
                ))}
            </div>
        );
    };

    const clearCells = () => {
        setSelectedSource("");
        setTextAreaValue("");
        setSplitIntoCells(false);
        setCellValues([]);
    };

    const selectSourceChoice = (source) => {
        setSelectedSource(source);
    };

    if (!currentUser) {
        return <p>Please log in</p>;
    }

    return (
        <div>
            <Toaster position="top-center" />
            <div className="upDowngradesJSONDataImport">
                <h1>Up/downgrades entry page:</h1>
                Source:{" "}
                <div className="btn-group" role="group" aria-label="...">
                    {sourceChoices.map((choice) => {
                        const btnClass = `btn btn-light${choice === selectedSource ? " active" : ""}`;
                        return (
                            <button
                                className={btnClass}
                                key={choice}
                                onClick={() => selectSourceChoice(choice)}
                            >
                                {choice}
                            </button>
                        );
                    })}
                </div>
                {!splitIntoCells ? (
                    <div className="textAreaEntryDiv">
                        <textarea
                            rows="20"
                            cols="100"
                            value={textAreaValue}
                            onChange={handleChange}
                        />
                    </div>
                ) : (
                    <div>
                        <div className="btn-group" role="group">
                            {sourceChoices.indexOf(selectedSource) === -1 ? (
                                "Please select a source"
                            ) : (
                                <button
                                    className="btn btn-light"
                                    onClick={
                                        verifyAndImportUpDownGradesJSONData
                                    }
                                >
                                    Import
                                </button>
                            )}
                            <button
                                className="btn btn-light"
                                onClick={clearCells}
                            >
                                Clear
                            </button>
                        </div>
                        <br />
                        {renderCells()}
                    </div>
                )}
            </div>
        </div>
    );
}

export default UpDownGradesJSONDataImport;
