const express = require('express');

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.user && req.user.hasRequiredRole === false) {
            return res.redirect('/');
        }
        return next();
    }
    res.redirect('/auth/discord');
}

module.exports = (app, passport) => {
    app.get('/', (req, res) => {
        res.render('index', { title: 'Login', page: 'login', user: req.user });
    });

    app.get('/dashboard', ensureAuthenticated, (req, res) => {
        res.render('dashboard', { title: 'Dashboard', page: 'dashboard', user: req.user });
    });

    app.get('/pending', ensureAuthenticated, async (req, res) => {
        const Giveaway = require('../models/Giveaway');
        const pendingGiveaways = await Giveaway.find({ status: 'pending' });
        res.render('pending', { title: 'Pending Giveaways', page: 'pending', user: req.user, pendingGiveaways });
    });

    app.get('/schedule', ensureAuthenticated, async (req, res) => {
        const Giveaway = require('../models/Giveaway');
        const scheduledGiveaways = await Giveaway.find({ status: 'scheduled' });
        res.render('schedule', { title: 'Schedule', page: 'schedule', user: req.user, scheduledGiveaways });
    });

    app.get('/statistics', ensureAuthenticated, (req, res) => {
        res.render('statistics', { title: 'Statistics', page: 'statistics', user: req.user });
    });

    app.get('/logs', ensureAuthenticated, (req, res) => {
        res.render('logs', { title: 'Logs', page: 'logs', user: req.user });
    });

    app.get('/quotas', ensureAuthenticated, (req, res) => {
        res.render('quotas', { title: 'Quotas', page: 'quotas', user: req.user });
    });

    app.get('/auth/discord', passport.authenticate('discord'));

    app.get('/auth/discord/callback', passport.authenticate('discord', {
        failureRedirect: '/'
    }), (req, res) => {
        res.redirect('/dashboard');
    });

    app.get('/logout', (req, res) => {
        req.logout(() => {
            res.redirect('/');
        });
    });
}; 