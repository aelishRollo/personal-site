import React from 'react';
import Lank from './Lank'
import '../App.css';
import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';

export default function Contact() {

    return (
        <div className="App">
            <header className="App-header">
                <p>
                I love meeting new people, and I reply to every email, so <Link to="/Contact"> say hello </Link>.
                </p>
                <Lank />
            </header >
        </div>
               
        );
}
