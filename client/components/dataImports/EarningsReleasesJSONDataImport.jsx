EarningsReleasesJSONDataImport = React.createClass({
    mixins: [ReactMeteorData],

    getMeteorData() {
        return {
            currentUser: Meteor.user()
        }
    },

    verifyAndImportUpDownGradesJSONData() {
        var _textAreaValue = this.refs.earningsReleasesTextArea.value;
        var _allStocks = [];
        var _lines = _textAreaValue.split(/\n/g);
        _lines.forEach(function(line) {
            var _symbolsInLine = line.split(",");
            _symbolsInLine.forEach(function(symbol) {
                if (symbol.length > 0) {
                    _allStocks.push(symbol.toUpperCase());
                }
            });
        });
        _allStocks = _.uniq(_allStocks);
        this.refs.earningsReleasesTextArea.value = "";
        Meteor.call('importData', _allStocks, 'earnings_releases');
    },

    render() {
        return (
            <div className="container">
                { this.data.currentUser ? (<div className="upDowngradesJSONDataImport">
                    <h1>Earnings Releases Data Import</h1>
                    <p>Please enter stock symbols separated by commas or new lines:</p>
                    <textarea ref="earningsReleasesTextArea" rows="20" cols="100"></textarea>
                    <button
                        onClick={this.verifyAndImportUpDownGradesJSONData}>import</button>
                </div>) : <p>plz log in</p> }
            </div>
        );
    }
});