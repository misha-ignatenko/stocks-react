App = React.createClass({

    mixins: [ReactMeteorData],

    getInitialState() {
        return {
            hideCompleted: false
        }
    },

    getMeteorData() {
        let pickListsQuery = {

        };

        return {
            pickLists: PickLists.find(pickListsQuery, {sort: {pickListDate: -1}}).fetch(),
            pickListCount: PickLists.find().count(),
            currentUser: Meteor.user()
        }
    },

    renderPickLists() {
        return this.data.pickLists.map((pickList) => {
            const currentUserId = this.data.currentUser && this.data.currentUser._id;
            const showPrivateButton = pickList.owner === currentUserId;

            return <PickList
                key={pickList._id}
                pickList={pickList}
                showPrivateButton={showPrivateButton} />;
        });
    },

    handleSubmitPickList(event) {
        event.preventDefault();
        var pickListName = React.findDOMNode(this.refs.textInput).value.trim();
        //TODO change new Date() below
        var pickListDate = new Date();
        var stocksList = [];


        //todo add more stuff here because a pick list is much more than just a name
        //TODO should be able to add new pick lists manually from client side as well as mass import using data

        Meteor.call("addPickList", pickListName, pickListDate, stocksList);
        React.findDOMNode(this.refs.textInput).value = "";
    },

    toggleHideCompleted() {
        this.setState({
            hideCompleted: ! this.state.hideCompleted
        });
    },

    render() {
        return (
            <div className="container">
                <header>
                    <h1>Pick Lists: ({this.data.pickListCount})</h1>

                    <label className="hide-completed">
                        <input
                            type="checkbox"
                            readOnly={true}
                            checked={this.state.hideCompleted}
                            onClick={this.toggleHideCompleted} />
                        Hide Completed Tasks
                    </label>

                    <AccountsUIWrapper />

                    { this.data.currentUser ?
                        <form className="new-pickList" onSubmit={this.handleSubmitPickList} >
                            <input
                                type="text"
                                ref="textInput"
                                placeholder="Type to add new pick lists" />
                        </form> : ''
                    }
                </header>

                <ul>
                    {this.renderPickLists()}
                </ul>
            </div>
        );
    }
});