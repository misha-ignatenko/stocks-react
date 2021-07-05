import React, { Component } from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import { Table } from 'reactstrap';

let selectedSymbol = new ReactiveVar(undefined);
let selectedFirmId = new ReactiveVar(undefined);
let showFirms = new ReactiveVar(true);

class RatingChangesConsistency extends Component{

    constructor(props) {
        super(props);

        this.state = {
        };

        this.showRes = this.showRes.bind(this);
        this.setFirm = this.setFirm.bind(this);
        this.handleErrorTableEdit = this.handleErrorTableEdit.bind(this);
    }

    showRes() {
        var _trimmed = this.refs.sym.value.trim().toUpperCase();
        if (_trimmed.length > 0) {
            selectedSymbol.set(_trimmed);
            selectedFirmId.set(undefined);
            showFirms.set(true);
            this.refs.sym.value = "";
        }
    }
    setFirm(event) {
        selectedFirmId.set(event.target.value);
        showFirms.set(false);
    }
    handleErrorTableEdit(id, type) {
        var edited = this.refs[id + "_" + type].value.trim();
    }
    removeDup(event) {
        Meteor.call("removeDupRatingChange", event.target.value, function (err, res) {
            console.log(err);
        });
    }
    renderRatingChangeHistory() {
        var _rCh = this.props.rChForFirm;
        var _rSc = this.props.ratingScales;
        var _displayData = [];
        if (_rCh) {
            _.each(_rCh, function (rc, index) {
                var _obj = {
                    _id: rc._id,
                    date: rc.dateString,
                    old: _.find(_rSc, function (rs) {return rs._id === rc.oldRatingId}).universalScaleValue,
                    new: _.find(_rSc, function (rs) {return rs._id === rc.newRatingId}).universalScaleValue
                };

                // check for problems
                if (index > 0) {
                    var _previousOld = _displayData[index - 1].old;
                    var _previousNew = _displayData[index - 1].new;
                    if (_obj.new === _previousNew && _obj.old === _previousOld) {
                        console.log("this is a duplicate: ", _obj.date);
                        _obj.duplicate = true;
                    } else if (_previousNew !== _obj.old) {
                        console.log("current old does not match previous new: ", _obj.date);
                        _obj.oldMismatch = true;
                    }
                }

                _displayData.push(_obj);
            })

            console.log(_displayData);
        }
        return <div>
            <h3>Rating Change History</h3>
            {_rCh ? <p>Symbol: {selectedSymbol.get()}. Firm: {selectedFirmId.get()}. Number of rating changes: {_rCh.length}</p> : null}

            {_rCh ? <ul>
                        {_displayData.map((data) => {
                            return <li key={data._id}>
                                date: {data.date}<br/>
                                old: {data.old}<br/>
                                new: {data.new}&nbsp;&nbsp;&nbsp;
                                {data.duplicate ?
                                    <button className="btn btn-light btn-sm" value={data._id} onClick={this.removeDup}>remove dup</button> :
                                    null}
                                </li>
                        })}
                    </ul> : null}
        </div>
    }

    ratingChangeErrors() {
        return <div>
            <h3>Errors in rating changes</h3>
            <Table bordered>
                <thead>
                    <tr>
                        <th>Research Firm</th>
                        <th>Symbol</th>
                        <th>Date</th>
                        <th>Old Rating</th>
                        <th>New Rating</th>
                    </tr>
                </thead>
                <tbody>
                    {this.props.errorRatingChanges.map((errorRatingChange) => {
                        var originalOld = errorRatingChange.originalRatingStrings.old;
                        var originalNew = errorRatingChange.originalRatingStrings.new;
                        var researchCompany = _.find(this.props.researchCompanies, researchCompany => researchCompany._id === errorRatingChange.researchFirmId);
                        return <tr key={errorRatingChange._id}>
                            <td>
                                <input ref={errorRatingChange._id + "_company"}
                                       defaultValue={researchCompany.name}
                                       onChange={() => this.handleErrorTableEdit(errorRatingChange._id, "company")}/>
                            </td>
                            <td>{errorRatingChange.symbol}</td>
                            <td>{errorRatingChange.dateString}</td>
                            <td>{originalOld}</td>
                            <td>{originalNew}</td>
                        </tr>;
                    })}
                </tbody>
            </Table>
        </div>
    }

    render() {

        return (
            <div className="container">
                { this.props.currentUser ? (<div className="ratingChangesConsistencyDiv">
                        <h1>Rating Changes Consistency</h1>
                        Symbol: <input ref="sym" /> <button className="btn btn-light" onClick={this.showRes}>Show Results</button>
                        {this.props.allRatingChanges ? <p>Total rating changes: {this.props.allRatingChanges.length}</p> : null}
                        {showFirms.get() && this.props.uniqFirmIds ? <div>{this.props.uniqFirmIds.map((firmId) => {
                            return <button key={firmId} value={firmId} className="btn btn-light btn-sm" onClick={this.setFirm}>{firmId}</button>
                            })}</div> : null}
                        {this.renderRatingChangeHistory()}
                        {this.ratingChangeErrors()}
                    </div>) : <p>Please log in.</p> }
            </div>
        );
    }
}

export default withTracker(() => {
    const symbol = selectedSymbol.get();

    var _data = {
        errorRatingChanges: [],
        researchCompanies: [],
        currentUser: Meteor.user()
    };
    if (symbol && Meteor.subscribe("allRatingChangesForSymbol", symbol).ready() && Meteor.subscribe("ratingScales").ready()) {
        _data.allRatingChanges = RatingChanges.find({symbol}, {sort: {dateString: 1}}).fetch();
        _data.uniqFirmIds = _.uniq(_.pluck(_data.allRatingChanges, "researchFirmId"));
        _data.ratingScales = RatingScales.find().fetch();
        var _firmId = selectedFirmId.get();
        if (_firmId) {
            _data.rChForFirm = _.filter(_data.allRatingChanges, function (rCh) { return rCh.researchFirmId === _firmId; })
        }
    }
    if (Meteor.subscribe("errorRatingChanges").ready()) {
        var errorRatingChanges = RatingChanges.find({isError: true}).fetch();
        if (Meteor.subscribe("researchCompaniesByIDs", _.uniq(_.pluck(errorRatingChanges, 'researchFirmId'))).ready()) {
            _data.errorRatingChanges = errorRatingChanges;
            _data.researchCompanies = ResearchCompanies.find().fetch();
        }
    }

    return _data;
})(RatingChangesConsistency);