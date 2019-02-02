require('dotenv').config();
const Discord = require('discord.io');
const request = require('request');
const HTMLParser = require('node-html-parser');
const puppeteer = require('puppeteer');
const wikiurl = 'http://ringofbrodgar.com/wiki/';
const forage = require('./forage.json');
const help = require('./help.json');
// const forage = JSON.parse(f);

const bot = new Discord.Client({
    // token: process.env.TOKEN,
    token: process.env.TOKEN,
    autorun: true
});

function getStatus(channelID) {
    request('http://www.havenandhearth.com/portal/', (err, res, body) => {
        if (!err) {
            parseStatus(body, channelID);
        } else {
            console.log(err);
        }
    });
}

function ucFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function getWikiPage(name, channelID) {
    if (name.length > 1) {
        for (let i = 0; i < name.length; i++) {
            name[i] = ucFirst(name[i]);
        }

        name = name.join('_');
    }
    console.log(name);

    request(`${wikiurl}${name}`, (err, res, body) => {
        if (!err) {
            if (HTMLParser.parse(body).toString().includes('There is currently no text in this page')) {
                bot.sendMessage({
                    to: channelID,
                    message: 'page does not exist'
                })
            } else {

                (async () => {

                    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
                    const page = await browser.newPage();
                    page.setViewport({width: 1000, height: 600, deviceScaleFactor: 1});

                    await page.goto(`${wikiurl}${name}`);

                    /**
                     * Takes a screenshot of a DOM element on the page, with optional padding.
                     *
                     * @param {!{path:string, selector:string, padding:(number|undefined)}=} opts
                     * @return {!Promise<!Buffer>}
                     */
                    async function screenshotDOMElement(opts = {}) {
                        const padding = 'padding' in opts ? opts.padding : 0;
                        const path = 'path' in opts ? opts.path : null;
                        const selector = opts.selector;

                        if (!selector)
                            throw Error('Please provide a selector.');

                        const rect = await page.evaluate(selector => {
                            const element = document.querySelector(selector);
                            if (!element)
                                return null;
                            const {x, y, width, height} = element.getBoundingClientRect();
                            return {left: x, top: y, width, height, id: element.id};
                        }, selector);

                        if (!rect) {
                            bot.sendMessage({
                                to: channelID,
                                message: `¯\\_(ツ)_/¯`
                            });
                            throw Error(`Could not find element that matches selector: ${selector}.`);
                        }
                        return await page.screenshot({
                            path,
                            clip: {
                                x: rect.left - padding,
                                y: rect.top - padding,
                                width: rect.width + padding * 2,
                                height: rect.height + padding * 2
                            }
                        });
                    }

                    await screenshotDOMElement({
                        path: 'element.png',
                        selector: '.infobox',
                        padding: 16
                    }).then(() => {
                        bot.uploadFile({
                            to: channelID,
                            file: 'element.png',
                            message: `<${wikiurl}${name}>`
                        }, error => console.log(error));
                        // bot.sendMessage({
                        //     to: channelID,
                        //     message: `${wikiurl}${name}`
                        // });
                    });

                    browser.close();
                })();

            }
        } else {
            console.log(err);
        }
    });
}

function parseStatus(body, channelID) {
    const root = HTMLParser.parse(body);
    const div = root.querySelector('#status');

    let status = '';
    for (let i = 0; i < div.childNodes.length; i++) {
        if (i % 2 > 0) {
            let text = div.childNodes[i].childNodes[0].text;
            text = text.replace(/\s\s+/g, ' ');
            text = text.replace(' up', ' **up**');
            console.log(text);
            status += text;
            status += '\n';
        }
    }
    bot.sendMessage({
        to: channelID,
        message: status
    });
}

function forageChance(name, channelID) {
    for (let i = 0; i < forage.length; i++) {
        if (forage[i].name.toLowerCase() === name.toLowerCase()) {
            let message = `The base PER EXP for **${name}** is ${forage[i].base}.\nYou'll start seeing it at **${forage[i].base / 2}**, and see all of it at **${forage[i].base * 2}**.`;
            bot.sendMessage({
                to: channelID,
                message: message
            });
            return;
        }
    }
    bot.sendMessage({
        to: channelID,
        message: `I didn't find a forageable named **${name}**. For a list of forageables say **!forage list** `
    });
}

function forageList(channelID) {
    let message = '';
    for (let f of forage) {
        message += `${f.name}, `;
    }
    message = message.substring(0, message.length - 2);
    message += '.';
    bot.sendMessage({
        to: channelID,
        message: message
    });
}

function forageListChance(per, exp, channelID) {
    const val = per * exp;
    let fields = [];
    for (let i = 0; i < forage.length; i++) {
        let chance = Math.round(100 * (2 * val - forage[i].base) / (3 * forage[i].base));
        if (chance <= 0) {
            continue;
        }
        if (chance > 100) chance = 100;

        fields[i] = {
            name: forage[i].name,
            value: `${chance}%`,
            inline: true
        }
    }

    if (fields.length <= 25) {

        let embed = {
            fields: fields
        };

        bot.sendMessage({
            to: channelID,
            embed: embed
        });

    } else if (fields.length <= 50) {

        let embed1 = {
            fields: fields.slice(0, 25)
        };

        let embed2 = {
            fields: fields.slice(25, fields.length)
        };

        bot.sendMessage({
            to: channelID,
            embed: embed1
        }, () => {
            bot.sendMessage({
                to: channelID,
                embed: embed2
            });
        });

    } else {
        let embed1 = {
            fields: fields.slice(0, 25)
        };

        let embed2 = {
            fields: fields.slice(25, 50)
        };

        let embed3 = {
            fields: fields.slice(50, fields.length)
        };

        bot.sendMessage({
            to: channelID,
            embed: embed1
        }, () => {
            bot.sendMessage({
                to: channelID,
                embed: embed2
            }, () => {
                bot.sendMessage({
                    to: channelID,
                    embed: embed3
                });
            });
        });
    }

}

bot.on('ready', (event) => {
    console.log('Connected');
    console.log(`Logged in as: ${bot.username} - ${bot.id}`);

    bot.setPresence({
        game:
            {
                name: "Haven & Hearth",
                type: 0
            }
    });
});

function sendHelp(channelID) {
    bot.sendMessage({
        to: channelID,
        embed: help
    });
}

bot.on('message', (user, userID, channelID, message, event) => {
    if (message.substring(0, 1) === '!') {
        let args = message.substring(1).split(' ');
        const cmd = args[0];

        args = args.splice(1);

        switch (cmd) {
            case 'help':
                sendHelp(channelID);
                break;

            case 'status':
                getStatus(channelID);
                break;

            case 'wiki':
                getWikiPage(args, channelID);
                break;

            case 'forage':
                if (args[0] === 'list') {
                    if (args.length === 3) {
                        if (!isNumber(args[1]) || !isNumber(args[2])) {
                            bot.sendMessage({
                                to: channelID,
                                message: "The correct format is ``!forage list PER EXP`` where PER and EXP are numbers"
                            });
                            return;
                        }
                        forageListChance(args[1], args[2], channelID);
                    } else {
                        forageList(channelID);
                    }
                } else {
                    if (args.length === 0 || args[0].trim() === "") {
                        bot.sendMessage({
                            to: channelID,
                            message: "Use ``!help`` for a list of commands."
                        });
                    } else {
                        forageChance(args.join(' '), channelID);
                    }
                }
                break;

            default:

                break;
        }
    }
});

function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

require('http').createServer().listen(3000);
