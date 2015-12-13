var _totalNUmberOfPossibleRatingThresholds = 12;

ImportRatingScales = React.createClass({
    mixins: [ReactMeteorData],

    getMeteorData() {
        return {
            currentUser: Meteor.user()
        }
    },
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
            Meteor.call("importData", {
                thresholdStringsArray: _allRatings,
                researchFirmString: this.refs.researchFirmString.value.trim(),
                beforeCoverageInitiatedString: this.refs.beforeCoverageInitiatedString.trim(),
                coverageDroppedString: this.refs.coverageDroppedString.trim()
            }, "grading_scales", function(error, result) {
                if (!error) {
                    console.log("success. imported grading scales");
                }
            })
        }
    },
    renderAllInputFields() {
        let _arrayOfInputRefs = [];
        for (var i = 1; i <= _totalNUmberOfPossibleRatingThresholds; i++) {
            _arrayOfInputRefs.push("ratingString" + i);
        }
        return _arrayOfInputRefs.map((refString) => {
            return <li key={refString}>Rating string: <input ref={refString}/></li>
        })
    },

    render() {

        return (
            <div className="container">
                { this.data.currentUser ? (<div className="ratingScalesDataImport">
                    <h1>Rating Scales Data Import</h1>
                    <h3>Please specify the rating scale for <input ref="researchFirmString"/> company, from lowest to highest:</h3>
                    <ol>
                        {this.renderAllInputFields()}
                        <li>Before coverage initiated string: <input ref="beforeCoverageInitiatedString"/></li>
                        <li>Coverage dropped string: <input ref="coverageDroppedString"/></li>
                    </ol>

                    <button onClick={this.submitRatingScales}>submit</button>
                </div>) : <p>plz log in</p> }
            </div>
        );
    }
});