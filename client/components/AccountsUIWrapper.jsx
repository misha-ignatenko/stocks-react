import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';

function AccountsUIWrapper() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');

    const currentUser = Meteor.user();

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (isLogin) {
            Meteor.loginWithPassword(username, password, (err) => {
                if (err) setError(err.reason);
            });
        } else {
            Accounts.createUser({ username, password }, (err) => {
                if (err) setError(err.reason);
            });
        }
    };

    const handleLogout = () => {
        Meteor.logout();
    };

    if (currentUser) {
        return (
            <div>
                Logged in as: {currentUser.username}
                <button onClick={handleLogout}>Logout</button>
            </div>
        );
    }

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit">{isLogin ? 'Login' : 'Sign Up'}</button>
                <button type="button" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? 'Need an account?' : 'Have an account?'}
                </button>
            </form>
            {error && <div style={{color: 'red'}}>{error}</div>}
        </div>
    );
}

export default AccountsUIWrapper;