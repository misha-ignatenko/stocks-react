UpDownGradesJSONDataImport = React.createClass({
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
    },
    verifyAndImportUpDownGradesJSONData() {
        var _importObjects = '[' + this.state.textAreaValue.substring(0,this.state.textAreaValue.length-1) + ']';
        var _parsed = JSON.parse(_importObjects);
        this.setState({
            textAreaValue: ""
        });
        Meteor.call('importData', _parsed, 'upgrades_downgrades', function(error, result) {
            if (!error && result) {
                $.bootstrapGrowl("Missing Rating Scales for the following: " + JSON.stringify(result), {
                    type: 'danger',
                    align: 'center',
                    width: 250,
                    delay: 100000
                });
            }
        });
    },

    render() {
        var textAreaValue = this.state.textAreaValue;
        return (
            <div className="container">
                { this.data.currentUser ? (<div className="upDowngradesJSONDataImport">
                    <h1>Up/downgrades entry page:</h1>
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