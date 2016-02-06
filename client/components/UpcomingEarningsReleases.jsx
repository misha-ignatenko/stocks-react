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
        var _allEarningsReleases = EarningsReleases.find({reportDateNextFiscalQuarter: {$exists: true}}).fetch();

        //now get indices of those corresponding qr1, 2 or whatever and see if item at that index inside earningsData array is between the requested start and end date
        var _upcomingEarningsReleases = [];
        _allEarningsReleases.forEach(function(release) {
            var _addToUpcomingList = false;
            if (release.reportDateNextFiscalQuarter >= _startDate &&
                release.reportDateNextFiscalQuarter <= _endDate
            ) {
                _addToUpcomingList = true;
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
        return this.data.upcomingEarningsReleases.map((release, index) => {
            let _btnClass = "btn" + (release.symbol === this.getSelectedSymbol() ? " btn-primary" : "");
            let _key = release.symbol + "_" + index;
            return <button key={_key} className={_btnClass} onClick={this.setNewSelectedSymbol.bind(this, release.symbol, index)}>{release.symbol}</button>
        })
    },
    setNewSelectedSymbol: function(symbol, indexInThisDataUpcomingEarningsReleases) {
        this.setState({
            earningsReleaseIndex: indexInThisDataUpcomingEarningsReleases
        });
    },
    previousEarningsRelease() {
        let _previousState = this.state.earningsReleaseIndex;
        let _newState = _previousState - 1 >= 0 ? _previousState - 1 : this.data.upcomingEarningsReleases.length - 1;
        this.setState({
            earningsReleaseIndex: _newState
        });
    },
    shouldComponentUpdate(nextProps, nextState) {
        if (this.state.startEarningsReleaseDateInteger !== nextState.startEarningsReleaseDateInteger || this.state.endEarningsReleaseDateInteger !== nextState.endEarningsReleaseDateInteger) {
            Meteor.subscribe("earningsReleases", nextState.startEarningsReleaseDateInteger, nextState.endEarningsReleaseDateInteger);
        }
        return true;
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
        $('#startEarningsReleaseDateInteger').val(this.convertQuandlFormatNumberDateToDateStringWithSlashes(this.state.startEarningsReleaseDateInteger));
        $('#endEarningsReleaseDateInteger').val(this.convertQuandlFormatNumberDateToDateStringWithSlashes(this.state.endEarningsReleaseDateInteger));
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
    convertQuandlFormatNumberDateToDateStringWithSlashes: function(_dateStringWithNoSlashesAsNumber) {
        _dateStringWithNoSlashesAsNumber = _dateStringWithNoSlashesAsNumber.toString();
        var _year = _dateStringWithNoSlashesAsNumber.substring(0,4);
        var _month = _dateStringWithNoSlashesAsNumber.substring(4,6);
        var _day = _dateStringWithNoSlashesAsNumber.substring(6,8);
        return _month + "/" + _day + "/" + _year;
    },
    getSelectedSymbol: function() {
        let _symbol = this.data.upcomingEarningsReleases &&
        this.data.upcomingEarningsReleases.length > 0 &&
        this.state.earningsReleaseIndex.toString() &&
        this.state.earningsReleaseIndex + 1 <= this.data.upcomingEarningsReleases.length ?
            this.data.upcomingEarningsReleases[this.state.earningsReleaseIndex].symbol : "undefinedd";
        return _symbol;
    },
    handleKeyDown: function(e) {
        let _symbolIndex = this.state.earningsReleaseIndex;
        let _new = e.which === 37 ? _symbolIndex-1 : e.which === 39 ? _symbolIndex+1 : _symbolIndex;
        if (_symbolIndex !== _new && this.data.upcomingEarningsReleases && this.data.upcomingEarningsReleases.length > 0) {
            if (e.which === 37) {
                this.previousEarningsRelease();
            } else if (e.which === 39) {
                this.nextEarningsRelease();
            }
        }
    },

    componentDidMount: function() {
        window.addEventListener('keydown', this.handleKeyDown);
    },

    componentWillUnmount: function() {
        window.removeEventListener('keydown', this.handleKeyDown);
    },

    componentWillMount: function () {
        Meteor.subscribe("earningsReleases", this.state.startEarningsReleaseDateInteger, this.state.endEarningsReleaseDateInteger);
    },

    render() {
        let _symbol = this.getSelectedSymbol();

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