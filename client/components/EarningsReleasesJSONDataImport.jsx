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