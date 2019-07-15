import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';

var _totalNUmberOfPossibleRatingThresholds = 12;

class ImportRatingScales extends Component {
    submitRatingScales() {
        let _allRatings = [];
        for (var i = 1; i <= _totalNUmberOfPossibleRatingThresholds; i++) {
            var _ref = "ratingString" + i;
            if (this.refs[_ref].value.trim().length > 0) {
                _allRatings.push(this.refs[_ref].value.trim());
            }
        }
        if (this.refs.researchFirmString.value.trim().length > 0 &&
            this.refs.beforeCoverageInitiatedString.value.trim().length > 0 &&
            this.refs.coverageDroppedString.value.trim().length > 0
        ) {
            var _objToInsert = {
                thresholdStringsArray: _allRatings,
                researchFirmString: this.refs.researchFirmString.value.trim(),
                beforeCoverageInitiatedString: this.refs.beforeCoverageInitiatedString.value.trim(),
                coverageDroppedString: this.refs.coverageDroppedString.value.trim()
            };
            if (this.refs.coverageTemporarilySuspendedString.value.trim().length > 0) {
                _objToInsert.coverageTemporarilySuspendedString = this.refs.coverageTemporarilySuspendedString.value.trim();
            }
            Meteor.call("importData", _objToInsert, "grading_scales", function(error, result) {
                if (!error && result) {
                    if (result.cannotImportGradingScalesDueToMissingPermissions) {
                        $.bootstrapGrowl("You do not have permission to import rating scales.", {
                            type: 'danger',
                            align: 'center',
                            width: 400,
                            delay: 10000000
                        });
                    } else {
                        $.bootstrapGrowl("Successfully imported grading scales.", {
                            type: 'success',
                            align: 'center',
                            width: 400,
                            delay: 10000000
                        });
                    }
                }
            })
        }
    }
    renderAllInputFields() {
        let _arrayOfInputRefs = [];
        for (var i = 1; i <= _totalNUmberOfPossibleRatingThresholds; i++) {
            _arrayOfInputRefs.push("ratingString" + i);
        }
        return _arrayOfInputRefs.map((refString) => {
            return <li key={refString}>Rating string: <input ref={refString}/></li>
        })
    }

    render() {

        return (
            <div className="container">
                { this.props.currentUser ? (<div className="ratingScalesDataImport">
                    <h1>Rating Scales Data Import</h1>
                    <h3>Please specify the rating scale for <input ref="researchFirmString"/> company, from lowest to highest:</h3>
                    <ol>
                        {this.renderAllInputFields()}
                        <li>Before coverage initiated string: <input ref="beforeCoverageInitiatedString"/></li>
                        <li>Coverage dropped string: <input ref="coverageDroppedString"/></li>
                        <li>Coverage temporarily suspended string:  <input ref="coverageTemporarilySuspendedString"/></li>
                    </ol>

                    <button onClick={this.submitRatingScales}>submit</button>
                </div>) : <p>plz log in</p> }
            </div>
        );
    }
}

export default withTracker(() => {

    return {
        currentUser: Meteor.user()
    }
})(ImportRatingScales);