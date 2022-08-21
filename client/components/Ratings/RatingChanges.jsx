import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import _ from 'underscore';
import { NavLink } from 'react-router-dom';

const ALL_MODE = 'all';
const SYMBOL_MODE = 'symbol';

// source: https://stackoverflow.com/questions/15547198/export-html-table-to-csv-using-vanilla-javascript
// Quick and simple export target #table_id into a csv
function download_table_as_csv(table_id, separator = ',') {
    // Select rows from table_id
    var rows = document.querySelectorAll('table#' + table_id + ' tr');
    // Construct csv
    var csv = [];
    for (var i = 0; i < rows.length; i++) {
        var row = [], cols = rows[i].querySelectorAll('td, th');
        for (var j = 0; j < cols.length; j++) {
            // Clean innertext to remove multiple spaces and jumpline (break csv)
            var data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, '').replace(/(\s\s)/gm, ' ')
            // Escape double-quote with double-double-quote (see https://stackoverflow.com/questions/17808511/properly-escape-a-double-quote-in-csv)
            data = data.replace(/"/g, '""');
            // Push escaped string
            row.push('"' + data + '"');
        }
        csv.push(row.join(separator));
    }
    var csv_string = csv.join('\n');
    // Download it
    var filename = 'export_' + table_id + '_' + new Date().toLocaleDateString() + '.csv';
    var link = document.createElement('a');
    link.style.display = 'none';
    link.setAttribute('target', '_blank');
    link.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv_string));
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

class RatingChanges extends Component {

    constructor(props) {
        super(props);

        this.state = {
            loading: false,
            mode: ALL_MODE,
            symbol: undefined,
            ratingChanges: [],
            symbolSearch: '',
            symbolSearchResults: [],

        };

        this.setMode = this.setMode.bind(this);
        this.onSymbolInput = this.onSymbolInput.bind(this);
        this.onSymbolInputChange = this.onSymbolInputChange.bind(this);
    }

    onSymbolInput = _.debounce(() => {
        const _that = this;
        const symbolSearch = _that.state.symbolSearch;
        if (!symbolSearch) return;

        Meteor.call('getSimilarSymbols', _that.state.symbolSearch, (err, symbolSearchResults) => {
            if (!err) _that.setState({symbolSearchResults});
        });
    }, 1000)

    onSymbolInputChange(event) {
        this.setState({
            symbolSearch: event.target.value,
        });
    }

    setMode(event) {
        const newMode = event.target.value;
        if (newMode !== this.state.mode) {
            if (newMode === SYMBOL_MODE) {
                this.setState({
                    mode: SYMBOL_MODE,
                    ratingChanges: [],
                });
            } else {
                this.setState({
                    mode: ALL_MODE,
                    symbol: undefined,
                    ratingChanges: [],
                });
            }
            this.loadRatingChanges(newMode);
        }
    }

    startLoading() {
        this.setState({
            loading: true,
        });
    }

    finishLoading(ratingChanges) {
        this.setState({
            loading: false,
            ratingChanges,
        });
    }

    loadRatingChanges(mode, symbol) {
        const _that = this;
        const isAllMode = mode === ALL_MODE;
        if (isAllMode) {
            _that.startLoading();
            Meteor.call('getLatestRatingChanges', (err, res) => {
                if (!err) _that.finishLoading(res);
            });
        } else {
            if (symbol) {
                _that.startLoading();
                Meteor.call('getLatestRatingChangesForSymbol', symbol, (err, res) => {
                    if (!err) _that.finishLoading(res);
                });
            }
        }
    }

    componentWillMount() {
        // initial load
        this.loadRatingChanges(ALL_MODE);
    }

    setSelectedSymbol(symbol) {
        this.setState({
            symbol,
            symbolSearchResults: [],
        });
        this.loadRatingChanges(SYMBOL_MODE, symbol);
    }

    exportCSV() {
        download_table_as_csv('ratingChanges');
    }

    renderSearchResults() {
        return this.state.symbolSearchResults.map((symbol) => (<button
            type="button"
            className='btn btn-light'
            key={symbol}
            onClick={this.setSelectedSymbol.bind(this, symbol)}
        >{symbol}</button>));
    }

    render() {
        const _b = "btn btn-light";
        const _ab = "btn btn-light active";
        const isLoading = this.state.loading;
        const isSymbolMode = this.state.mode === SYMBOL_MODE;
        const ratingChanges = this.state.ratingChanges;

        return (
            <div>
                <br/>
                <div>
                    <div className="container">
                        <div className="btn-group" role="group" aria-label="...">
                            <button
                                type="button"
                                className={this.state.mode === ALL_MODE ? _ab : _b}
                                value={ALL_MODE}
                                onClick={this.setMode}
                            >
                                All symbols
                            </button>
                            <button
                                type="button"
                                className={this.state.mode === SYMBOL_MODE ? _ab : _b}
                                value={SYMBOL_MODE}
                                onClick={this.setMode}
                            >
                                Specific Symbol
                            </button>
                        </div>
                        <br/>
                        {isLoading ? <div>
                            Loading...
                        </div> : <div>
                            {isSymbolMode && <div>
                                <input
                                    className="individualStockSearch"
                                    id="individualStockSearch"
                                    onKeyDown={this.onSymbolInput}
                                    onChange={this.onSymbolInputChange}
                                />
                                <div id="individualStockSearchResults">{this.renderSearchResults()}</div>
                                {this.state.symbol && <div>
                                    Selected symbol: {this.state.symbol}
                                </div>}
                            </div>}
                            Displaying {this.state.ratingChanges.length} rating changes within the last {StocksReactUtils.ratingChangesLookbackMonths} months

                            {' '}
                            <button type='button' className={_b} onClick={this.exportCSV}>
                                Export as a CSV
                            </button>
                            <br/>
                            To view more, <NavLink to="/contact" >Contact Us</NavLink>
                            <table id='ratingChanges'>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Symbol</th>
                                        <th>Research Firm</th>
                                        <th>Old Rating</th>
                                        <th>New Rating</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {ratingChanges.map((row) => {
                                        const {
                                            dateString,
                                            symbol,
                                            researchFirmName,
                                            oldRating,
                                            newRating,
                                        } = row;
                                        const rowKey = dateString + symbol + researchFirmName;

                                        return <tr key={rowKey}>
                                            <td>{dateString}</td>
                                            <td>{symbol}</td>
                                            <td>{researchFirmName}</td>
                                            <td>{oldRating}</td>
                                            <td>{newRating}</td>
                                        </tr>;
                                    })}
                                </tbody>
                            </table>
                        </div>}
                    </div>
                </div>
            </div>
        );
    }
}

export default withTracker((props) => {
    let _data = {};

    return _data;
})(RatingChanges);
