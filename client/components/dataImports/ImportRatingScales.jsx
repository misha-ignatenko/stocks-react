import React, { useState } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import toast, { Toaster } from 'react-hot-toast';

const TOTAL_NUMBER_OF_POSSIBLE_RATING_THRESHOLDS = 12;

function ImportRatingScales() {
    const [researchFirmString, setResearchFirmString] = useState('');
    const [beforeCoverageInitiatedString, setBeforeCoverageInitiatedString] = useState('');
    const [coverageDroppedString, setCoverageDroppedString] = useState('');
    const [coverageTemporarilySuspendedString, setCoverageTemporarilySuspendedString] = useState('');
    const [ratingStrings, setRatingStrings] = useState(
        Array(TOTAL_NUMBER_OF_POSSIBLE_RATING_THRESHOLDS).fill('')
    );

    const { currentUser } = useTracker(() => ({
        currentUser: Meteor.user()
    }), []);

    const handleRatingStringChange = (index, value) => {
        const updatedRatingStrings = [...ratingStrings];
        updatedRatingStrings[index] = value;
        setRatingStrings(updatedRatingStrings);
    };

    const submitRatingScales = () => {
        // Get all non-empty rating strings
        const allRatings = ratingStrings
            .map(rating => rating.trim())
            .filter(rating => rating.length > 0);

        // Validate required fields
        if (!researchFirmString.trim() ||
            !beforeCoverageInitiatedString.trim() ||
            !coverageDroppedString.trim()) {
            toast.error('Please fill in all required fields');
            return;
        }

        const objToInsert = {
            thresholdStringsArray: allRatings,
            researchFirmString: researchFirmString.trim(),
            beforeCoverageInitiatedString: beforeCoverageInitiatedString.trim(),
            coverageDroppedString: coverageDroppedString.trim()
        };

        if (coverageTemporarilySuspendedString.trim().length > 0) {
            objToInsert.coverageTemporarilySuspendedString = coverageTemporarilySuspendedString.trim();
        }

        Meteor.call('importData', objToInsert, 'grading_scales', (error, result) => {
            if (!error && result) {
                if (result.cannotImportGradingScalesDueToMissingPermissions) {
                    toast.error("You do not have permission to import rating scales.", {
                        duration: 10000
                    });
                } else {
                    toast.success("Successfully imported grading scales.", {
                        duration: 10000
                    });
                    // Clear form on success
                    clearForm();
                }
            } else if (error) {
                toast.error(`Import failed: ${error.message}`);
            }
        });
    };

    const clearForm = () => {
        setResearchFirmString('');
        setBeforeCoverageInitiatedString('');
        setCoverageDroppedString('');
        setCoverageTemporarilySuspendedString('');
        setRatingStrings(Array(TOTAL_NUMBER_OF_POSSIBLE_RATING_THRESHOLDS).fill(''));
    };

    const renderAllInputFields = () => {
        return ratingStrings.map((value, index) => (
            <li key={`ratingString${index + 1}`}>
                Rating string:{' '}
                <input
                    value={value}
                    onChange={(e) => handleRatingStringChange(index, e.target.value)}
                    placeholder={`Rating ${index + 1}`}
                />
            </li>
        ));
    };

    if (!currentUser) {
        return (
            <div className="container">
                <p>Please log in</p>
            </div>
        );
    }

    return (
        <div className="container">
            <Toaster position="top-center" />
            <div className="ratingScalesDataImport">
                <h1>Rating Scales Data Import</h1>
                <h3>
                    Please specify the rating scale for{' '}
                    <input
                        value={researchFirmString}
                        onChange={(e) => setResearchFirmString(e.target.value)}
                        placeholder="Company name"
                    />{' '}
                    company, from lowest to highest:
                </h3>
                <ol>
                    {renderAllInputFields()}
                    <li>
                        Before coverage initiated string:{' '}
                        <input
                            value={beforeCoverageInitiatedString}
                            onChange={(e) => setBeforeCoverageInitiatedString(e.target.value)}
                            placeholder="e.g., Not Rated"
                        />
                    </li>
                    <li>
                        Coverage dropped string:{' '}
                        <input
                            value={coverageDroppedString}
                            onChange={(e) => setCoverageDroppedString(e.target.value)}
                            placeholder="e.g., Coverage Dropped"
                        />
                    </li>
                    <li>
                        Coverage temporarily suspended string:{' '}
                        <input
                            value={coverageTemporarilySuspendedString}
                            onChange={(e) => setCoverageTemporarilySuspendedString(e.target.value)}
                            placeholder="(Optional) e.g., Suspended"
                        />
                    </li>
                </ol>

                <button onClick={submitRatingScales}>Submit</button>
                <button onClick={clearForm} style={{ marginLeft: '10px' }}>Clear</button>
            </div>
        </div>
    );
}

export default ImportRatingScales;