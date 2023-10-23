import React from 'react';
import Lank from './Lank'
import '../App.css';
import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';

export default function Contact() {

    return (
        <div className="App">
            <header className="App-header">
                <p>
                    I'm currently using node.js with typescript and React. I'm in favor of test driven development.
                    Also, I think it's beautiful that with some basic programming knowledge, we have the power to create new tools for anything we
                    dream up.
                </p>
            
            <Lank />
        </header >
        </div >

    );
}
