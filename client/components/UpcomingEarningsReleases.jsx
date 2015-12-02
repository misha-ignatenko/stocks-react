UpcomingEarningsReleases = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState() {
        return {
            startEarningsReleaseDateInteger: parseInt(moment(new Date().toISOString()).format("YYYYMMDD")),
            endEarningsReleaseDateInteger: parseInt(moment(new Date().toISOString()).add(10, 'days').format("YYYYMMDD")),
            earningsReleaseIndex: 0
        }
    },

    getMeteorData() {


        //check if EXP_RPT_DATE_QR1 or EXP_RPT_DATE_QR2 exist inside earningreleases collection
        //TODO: need code for EXP_RPT_DATE_QR3 and EXP_RPT_DATE_QR4

        //generate 2 numbers based on todays
        var _startDate = this.state.startEarningsReleaseDateInteger;
        var _endDate = this.state.endEarningsReleaseDateInteger;
        var _allEarningsReleases = EarningsReleases.find({$or: [
            {fieldNames: "EXP_RPT_DATE_QR1"},
            {fieldNames: "EXP_RPT_DATE_QR4"},
            {fieldNames: "EXP_RPT_DATE_QR3"},
            {fieldNames: "EXP_RPT_DATE_QR4"}
        ]}).fetch();

        //now get indices of those corresponding qr1, 2 or whatever and see if item at that index inside earningsData array is between the requested start and end date
        var _upcomingEarningsReleases = [];
        _allEarningsReleases.forEach(function(release) {
            var _addToUpcomingList = false;
            for (var i=1; i<=4; i++) {
                var _fieldName = "EXP_RPT_DATE_QR" + i;
                if (_.indexOf(release.fieldNames, _fieldName) > -1 &&
                    release.earningsData[_.indexOf(release.fieldNames, _fieldName)] >= _startDate &&
                    release.earningsData[_.indexOf(release.fieldNames, _fieldName)] <= _endDate
                ) {
                    _addToUpcomingList = true;
                    break;
                }
            }

            if (_addToUpcomingList) {
                _upcomingEarningsReleases.push(release);
            }
        });

        return {
            currentUser: Meteor.user(),
            upcomingEarningsReleases: _upcomingEarningsReleases
        }
    },
    renderUpcomingEarningsReleases() {
        return this.data.upcomingEarningsReleases.map((release) => {
            return <button key={release.symbol}>{release.symbol}</button>
        })
    },
    previousEarningsRelease() {
        let _previousState = this.state.earningsReleaseIndex;
        let _newState = _previousState - 1 >= 0 ? _previousState - 1 : this.data.upcomingEarningsReleases.length - 1;
        this.setState({
            earningsReleaseIndex: _newState
        });
    },
    nextEarningsRelease() {
        let _previousState = this.state.earningsReleaseIndex;
        let _newState = _previousState + 1 <= this.data.upcomingEarningsReleases.length - 1 ? _previousState + 1 : 0;
        this.setState({
            earningsReleaseIndex: _newState
        });
    },
    setDatepickerOptions: function() {
        let _datepickerOptions = {
            autoclose: true,
            todayHighlight: true,
            orientation: "top auto"
        };
        $('#startEarningsReleaseDateInteger').datepicker(_datepickerOptions);
        $('#endEarningsReleaseDateInteger').datepicker(_datepickerOptions);
        var _that = this;

        $('.datepickerInput2').on('change', function() {
            let _newVal = $(this).val();
            let _momentDate = parseInt(moment(new Date(_newVal).toISOString()).format("YYYYMMDD"));
            let _id = $(this).attr('id');
            let _set = {};
            _set[_id] = _momentDate;
            _that.setState(_set);
        });
    },

    render() {
        let _symbol = this.data.upcomingEarningsReleases &&
            this.data.upcomingEarningsReleases.length > 0 &&
            this.state.earningsReleaseIndex.toString() &&
            this.state.earningsReleaseIndex + 1 <= this.data.upcomingEarningsReleases.length ?
            this.data.upcomingEarningsReleases[this.state.earningsReleaseIndex].symbol : "undefined";

        return (
            <div className="container">
                { this.data.currentUser ? (
                    this.data.currentUser.registered ? (
                        <div>
                            <br/>
                            <div className="datepickers" ref={this.setDatepickerOptions}>
                                start date:
                                <input className="datepickerInput2" id="startEarningsReleaseDateInteger"/>
                                <br/>
                                end date:
                                <input className="datepickerInput2" id="endEarningsReleaseDateInteger" />
                            </div>
                            <br/>
                            <button onClick={this.previousEarningsRelease}>previous</button>
                            <button onClick={this.nextEarningsRelease}>next</button>
                            <br/>
                            { this.renderUpcomingEarningsReleases() }
                            <br/>
                            <br/>
                            <UpcomingEarningsRelease symbol={_symbol} currentUser={this.data.currentUser}/>
                            <br/>
                        </div>
                    ) : null
                ) : null}
            </div>
        );
    }
});