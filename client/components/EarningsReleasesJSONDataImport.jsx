EarningsReleasesJSONDataImport = React.createClass({
    mixins: [ReactMeteorData],

    getMeteorData() {
        return {
            currentUser: Meteor.user()
        }
    },

    getInitialState() {
        return {
            textAreaValue: ''
        }
    },

    handleChange(event) {
        this.setState({
            textAreaValue: event.target.value
        })
        console.log("the state of textarea is now: ", this.state.textAreaValue);
    },
    verifyAndImportUpDownGradesJSONData() {
        var _importObjects = '[' + this.state.textAreaValue.substring(0,this.state.textAreaValue.length-1) + ']';
        var _parsed = JSON.parse(_importObjects);
        this.setState({
            textAreaValue: ""
        });
        console.log(_parsed.length);
        Meteor.call('importData', _parsed, 'earnings_releases');
    },

    render() {
        var textAreaValue = this.state.textAreaValue;
        return (
            <div className="container">
                { this.data.currentUser ? (<div className="upDowngradesJSONDataImport">
                    <h1>Earnings Releases Data Import</h1>
                    <p>Please be sure to specify the following:</p>
                    <ul>
                        <li>symbol: string</li>
                        <li>dateString: yyyy-mm-dd format</li>
                        <li>releaseTime: "before", "during", or "after" market</li>
                        <li>datetime: specific date and time of the earning release (optional)</li>
                        <li>source: of this earning release info (example, "NASDAQ")</li>
                        <li>consensusEps: expected upcoming EPS without the $ sign</li>
                        <li>numOfEstimates: number of analyst estimates for this EPS (optional)</li>
                        <li>lastYearsReportDateString: date of earnings report 1 year ago (optional)</li>
                        <li>lastYearsEps: actual EPS from last year without the $ sign</li>
                    </ul>
                    <textarea rows="20" cols="100"
                              value={textAreaValue}
                              onChange={this.handleChange}></textarea>
                    <button
                        onClick={this.verifyAndImportUpDownGradesJSONData}>import</button>
                </div>) : <p>plz log in</p> }
            </div>
        );
    }
});