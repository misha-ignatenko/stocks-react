import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import _ from 'underscore';
import { NavLink } from 'react-router-dom';
import {
    Table,
} from 'reactstrap';

const ALL_MODE = 'all';
const SYMBOL_MODE = 'symbol';

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

    async componentWillMount() {
        // initial load
        const stats = await Meteor.callNoCb('getRatingChangeMetadata');
        this.setState(stats);
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
        Utils.download_table_as_csv('ratingChanges');
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
                            To view more (<b>{this.state.numChanges}</b> rating changes across <b>{this.state.numFirms}</b> analyst firms), <NavLink to="/contact" >Contact Us</NavLink>
                            <br/><br/>
                            <Table id='ratingChanges' bordered>
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
                            </Table>
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
