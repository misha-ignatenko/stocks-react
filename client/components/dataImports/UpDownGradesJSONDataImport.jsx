import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';

class UpDownGradesJSONDataImport extends Component {

    constructor(props) {
        super(props);

        this.state = {
            sourceChoices: [
                'f',
                'b',
                's',
                'other',
            ],
            selectedSource: "",
            textAreaValue: '',
            splitIntoCells: false,
            cellValues: []
        };

        this.handleChange = this.handleChange.bind(this);
        this.handleIndividualCellChange = this.handleIndividualCellChange.bind(this);
        this.verifyAndImportUpDownGradesJSONData = this.verifyAndImportUpDownGradesJSONData.bind(this);
        this.clearCells = this.clearCells.bind(this);
    }

    handleChange(event) {
        //parse stuff here and set splitIntoCells to true of all items contain the keys from 1st object
        var _textAreaNewValue = event.target.value;
        var _allLines = _textAreaNewValue.split("\n");
        var _splitByTabsAndNewLines = [];
        _allLines.forEach(function(line) {
            var _splitLine = line.split("\t");
            _splitByTabsAndNewLines.push(_splitLine);
        });
        var _parsed = [];
        if (_splitByTabsAndNewLines.length > 0) {
            var _keyz = _splitByTabsAndNewLines[0];
            //remove keys, which is the first item in this array
            _splitByTabsAndNewLines.shift();
            _splitByTabsAndNewLines.forEach(function(dataArr){
                var _everyItemInDataArrIsNonBlank = true;
                dataArr.forEach(function(val) {
                    if (val === "") {
                        _everyItemInDataArrIsNonBlank = false;
                    }
                });
                if (_everyItemInDataArrIsNonBlank) {
                    var _row = {};
                    _keyz.forEach(function(key, index) {
                        _row[key] = dataArr[index];
                    });
                    _parsed.push(_row);
                }
            });
        }



        //var _importObjects = '[' + _textAreaNewValue.substring(0,_textAreaNewValue.length-1) + ']';
        //var _parsed = JSON.parse(_importObjects);
        if (_parsed.length > 0) {
            var _firstObj = _parsed[0];
            var _keys = [];
            for (var key in _firstObj) {
                _keys.push(key);
            }
            //make sure that every object in parsed contains these fields
            // if not, then alert the user
            var _problems = [];
            _parsed.forEach(function(obj, index) {
                _keys.forEach(function(key) {
                    if (!obj[key]) {
                        _problems.push({
                            index: index,
                            key: key
                        });
                    }
                });
            });
            if (_problems.length > 0) {
                //todo alert the user
                console.log("problems: ", _problems);
            } else {
                this.setState({
                    splitIntoCells: true,
                    cellValues: _parsed
                });
            }
        }

        this.setState({
            textAreaValue: _textAreaNewValue
        })
    }
    verifyAndImportUpDownGradesJSONData() {
        //var _importObjects = '[' + this.state.textAreaValue.substring(0,this.state.textAreaValue.length-1) + ']';
        //var _parsed = JSON.parse(_importObjects);
        //this.setState({
        //    textAreaValue: ""
        //});
        var _parsed = this.state.cellValues;
        let _source = this.state.selectedSource;
        _parsed = _.map(_parsed, function (importItem) {
            return _.extend(importItem, {"source": _source});
        });
        this.clearCells();
        Meteor.call('importData', _parsed, 'upgrades_downgrades', function(error, result) {
            if (!error && result) {
                if (result.noPermissionToImportUpgradesDowngrades) {
                    $.bootstrapGrowl("You do not have permission to import upgrades/downgrades.", {
                        type: 'danger',
                        align: 'center',
                        width: 400,
                        delay: 10000000
                    });
                } else if (result.couldNotFindGradingScalesForTheseUpDowngrades.length > 0) {
                    $.bootstrapGrowl("Missing Rating Scales for the following: " + JSON.stringify(result), {
                        type: 'danger',
                        align: 'center',
                        width: 800,
                        delay: 10000000
                    });
                } else if (result.upgradesDowngradesImportStats) {
                    var _importStats = result.upgradesDowngradesImportStats;
                    $.bootstrapGrowl("imported stats<br>new: " + _importStats.new + "<br>duplicates: " + _importStats.duplicates +
                        "<br>out of: " + _importStats.total, {
                        type: 'success',
                        align: 'center',
                        width: 250,
                        delay: 10000000
                    });
                } else {
                    //TODO show success bootstrapGrowl
                }
            }
        });
    }

    componentWillUnmount() {
        $(".bootstrap-growl").remove();
    }

    handleIndividualCellChange(event) {
        var _id = $(event.target).attr("id");
        var _key = _id.split("_")[1];
        var _index = _id.split("_")[0];

        var _previousCellValues = this.state.cellValues;
        _previousCellValues[_index][_key] = event.target.value;
        this.setState({cellValues: _previousCellValues});
    }
    renderCells() {
        var _firstObj = this.state.cellValues[0];
        var _keys = [];
        for (var key in _firstObj) {
            _keys.push(key);
        }
        return (
            <div>


                <div className="row">
                {_keys.map((key) => {
                    var _keyyy = key.replace(/ /g,"_");
                    return <div className="col-md-2" key={_keyyy}>
                        <span key={_keyyy}>{key}</span>
                    </div>
                })}
                </div>


                {this.state.cellValues.map((cellValues, index) => {
                    var keys = _keys;
                    return (<div className="row" key={index}>{_keys.map((keyy) => {
                        const val = cellValues[keyy];
                        const _key = index.toString() + "_" + keyy;

                        return <div className="col-md-2" key={_key}><input className="simpleInput" id={_key} key={_key} value={val} onChange={this.handleIndividualCellChange}/></div>;
                    })}<br/></div>)
                })}
            </div>
        );
    }
    clearCells() {
        this.setState({
            selectedSource: "",
            textAreaValue: '',
            splitIntoCells: false,
            cellValues: []
        });
    }

    selectSourceChoice (source) {
        this.setState({
            selectedSource: source
        })
    }

    render() {
        var textAreaValue = this.state.textAreaValue;
        var _selectedSource = this.state.selectedSource;
        return (
            <div>
                { this.props.currentUser ? (<div className="upDowngradesJSONDataImport">
                    <h1>Up/downgrades entry page:</h1>
                    {/*<h3>The total number of records in NewStockPrices collection for 2016-07-08 is: {this.data.newStockPricesCount}</h3>*/}
                    Source: <div className="btn-group" role="group" aria-label="...">
                        {this.state.sourceChoices.map((choice) => {
                            let _btnClass = ("btn btn-light") + (choice === _selectedSource ? " active" : "");
                            return <button className={_btnClass} key={choice} onClick={this.selectSourceChoice.bind(this, choice)}>{choice}</button>
                        })}
                    </div>
                    {!this.state.splitIntoCells ?
                        <div className="textAreaEntryDiv">
                            <textarea rows="20" cols="100"
                                      value={textAreaValue}
                                      onChange={this.handleChange}></textarea>
                        </div> :
                        <div>
                            {this.renderCells()}
                            <br/>
                            {this.state.sourceChoices.indexOf(this.state.selectedSource) === -1 ?
                                "please select a source" :
                                <button
                                    onClick={this.verifyAndImportUpDownGradesJSONData}>import</button> }
                            <br/>
                            <button className="btn btn-light" onClick={this.clearCells}>clear</button>
                        </div>
                    }
                </div>) : <p>plz log in</p> }
            </div>
        );
    }
}

export default withTracker(() => {

    return {
        currentUser: Meteor.user()
    }
})(UpDownGradesJSONDataImport);