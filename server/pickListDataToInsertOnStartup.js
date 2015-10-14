if (Meteor.isServer) {
    Meteor.methods({
        getStartupPickListData: function() {
            var _result = [];


            //sample pick list 1
            var _pickListId1 = "4zAr99jmwRLbYdSBg";
            var _pickListItems1 = [
                { pickListId: _pickListId1, stockId: "ACT", dateAdded: "2014-10-02", ratingWhenAdded: "3"},
                { pickListId: _pickListId1, stockId: "GAS", dateAdded: "2014-08-07", ratingWhenAdded: "2"},
                { pickListId: _pickListId1, stockId: "ALXN", dateAdded: "2011-10-17", ratingWhenAdded: "3"},
                { pickListId: _pickListId1, stockId: "AGN", dateAdded: "2014-02-18", ratingWhenAdded: "2"},
                { pickListId: _pickListId1, stockId: "ALL", dateAdded: "2013-07-01", ratingWhenAdded: "3"}
            ];
            _result.push({
                pickListId: _pickListId1,
                pickListItems: _pickListItems1
            });

            //sample pick list 2
            var _pickListId2 = "TdrBh5PdabDtehfNP";
            var _pickListItems2 = [
                { pickListId: _pickListId2, stockId: "AAPL", dateAdded: "2014-11-21"},
                { pickListId: _pickListId2, stockId: "ABAX", dateAdded: "2014-11-21"},
                { pickListId: _pickListId2, stockId: "AKRX", dateAdded: "2014-11-21"},
                { pickListId: _pickListId2, stockId: "ALXN", dateAdded: "2014-11-21"},
                { pickListId: _pickListId2, stockId: "AMGN", dateAdded: "2014-11-21"}
            ];
            _result.push({
                pickListId: _pickListId2,
                pickListItems: _pickListItems2
            });


            return _result;
        }
    });
}