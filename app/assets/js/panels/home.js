'use strict';

import AccDatabase from '../lib/AccDatabase.js';

const fs = require("fs");
const convert = require("xml-js");
const net = require('net');

class Home {
  static id = "home";

  async init(popup){
    this.accounts = await new AccDatabase().init();
    this.popup = popup;

    this.parseNews();
    this.initStatus();
    this.initLinks();
  }

  async parseNews(){
    let news = document.querySelector(".news");
    console.log("[Home] Initializing News...");
    try {
      let rss = await fetch("https://api.evoniamc.eu/news.rss").then(res => res.text());
      let rssparse = JSON.parse(convert.xml2json(rss, {compact: true}));
      if(!rssparse.rss && rssparse.response && rssparse.response.message){
        let block = document.createElement("div");
        block.classList.add("block");
        if(rssparse.response.message._cdata.indexOf("youtube.com/embed") != -1)
          rssparse.response.message._cdata = rssparse.response.message._cdata.replace(">", " style=\"height: calc((100vmin*1080)/1920)\">");
        block.innerHTML = `
        <div class="news-header">
          <div class="header-text">
            <img class="avatar" src="assets/images/avatar.png"></img>
            <a class="title" href="https://paladium-pvp.fr/">Site en maintenance</a>
          </div>
        </div>
        <div class="news-content"><div class="bbWrapper">${rssparse.response.message._cdata}</div></div>
        `;
        news.appendChild(block);
        await sleep(100);
        let anchors = document.querySelectorAll('a[href^="http"]');
        for(let anchor of anchors){
          anchor.addEventListener("click", (event) => {
            event.preventDefault();
            if(event.target.tagName.toLowerCase() != "a") nw.Shell.openExternal(event.target.parentElement.href);
            else nw.Shell.openExternal(event.target.href);
          });
        }
        return;
      } else rssparse = rssparse.rss;
      if(rssparse.dchannel) rssparse = rssparse.dchannel.item;
      else rssparse = rssparse.channel.item;
      if(!(rssparse instanceof Array)) rssparse = [rssparse];
      if(rssparse.length > 5) rssparse = rssparse.slice(0, 5);
      for await (let item of rssparse){
        let date = this.toDate(new Date(item["pubDate"]._text));
        let block = document.createElement("div");
        block.classList.add("block");
        let text = item["title"]._text;
        if(text.length > 61) text.slice(0, 61) + "...";
        block.innerHTML = `
        <div class="news-header">
          <div class="header-text">
            <img class="avatar" src="assets/images/avatar.png"></img>
            <a class="title" href="${item["link"]._text}">${item["title"]._text}</a>
          </div>
          <div class="date">
            <div class="day">${date.day}</div>
            <div class="month">${date.month}</div>
          </div>
          <br>
          <div>${item["description"]._text}</div>
        </div>
        `;
        let anchors = block.querySelectorAll("a.link.link--external");
        if(anchors.length > 0 && anchors[anchors.length-1].href.toLowerCase() == item["link"]._text.toLowerCase()){
          let br = anchors[anchors.length-1].previousElementSibling;
          anchors[anchors.length-1].parentElement.removeChild(br);
          anchors[anchors.length-1].parentElement.removeChild(anchors[anchors.length-1])
        }
        news.appendChild(block);
      }
    } catch(e) {
      console.error(e);
      let date = this.toDate(new Date());
      let block = document.createElement("div");
      block.classList.add("block");
      block.innerHTML = `
      <div class="news-header error">
        <div class="header-text">
          <img class="avatar" src="assets/images/error.png"></img>
          <a class="title" href="https://evoniamc.eu/">Une erreur est survenue. Merci de réessayer plus tard.</a>
        </div>
      </div>
      `;
      news.appendChild(block);
    }
    let anchors = document.querySelectorAll('a[href^="http"]');
    for(let anchor of anchors){
      anchor.addEventListener("click", (event) => {
        event.preventDefault();
        if(event.target.tagName.toLowerCase() != "a") nw.Shell.openExternal(event.target.parentElement.href);
        else nw.Shell.openExternal(event.target.href);
      });
    }
  }

  toDate(date){
    let months = ["Jan.", "Fév.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Dec."];
    let days = [];
    for(let i=1; i < 60; i++) days.push(i);
    return {day: days[date.getDate()-1], month: months[date.getMonth()]}
  }

  initStatus(){
    console.log("[Home] Initializing Server Status...");
    this.setStatus();
    setInterval(this.setStatus, 60000)
  }

  async setStatus(){
    let player = document.querySelector(".etat-text .text");
    let desc = document.querySelector(".server-text .desc");
    let online = document.querySelector(".etat-text .online");

    let server = await testServer("46.105.156.212:25982");

    if(server.error){
      server = await testServer("46.105.156.212:25565");
      if(server.error){
        desc.innerHTML = `<span class="red">Fermé</span> - 0ms`;
        if(!online.classList.contains("off")) online.classList.toggle("off");
        return player.textContent = 0;
      }
    }

    desc.innerHTML = `<span class="green">Opérationnel</span> - ${server.ms}ms`;
    if(online.classList.contains("off")) online.classList.toggle("off");
    player.textContent = server.players;

    async function testServer(ip){
      return new Promise((resolve) => {
        let start = new Date();
        let client = net.connect(25565, ip, () => {
          client.write(Buffer.from([ 0xFE, 0x01 ]));
        });
    
        client.setTimeout(5 * 1000);
    
        client.on('data', (data) => {
          if (data != null && data != '') {
            var infos = data.toString().split("\x00\x00\x00");
            resolve({error: false, ms: Math.round(new Date() - start), players: infos[4].replace(/\u0000/g, '')});
          }
          client.end();
        });
    
        client.on('timeout', () => {
          resolve({error: true});
          client.end();
        });
    
        client.on('err', (err) => {
          resolve({error: true});
          console.error(err);
        });
      });
    }
  }

  initLinks(){
    let status = document.querySelector(".status");
    status.addEventListener("click", () => {
      nw.Shell.openExternal("http://status.evoninamc.eu");
    });

    /* store */

    let challenger = document.querySelector(".store-item.challenger .item-info");
    challenger.addEventListener("click", () => {
      nw.Shell.openExternal("https://store.paladium-pvp.fr/category/grades-v7#page");
    });

    /* follow */

    let paladium = document.querySelector("#website.follow-link");
    paladium.addEventListener("click", () => {
      nw.Shell.openExternal("https://evoniamc.eu/");
    });
    let twitter = document.querySelector("#twitter.follow-link");
    twitter.addEventListener("click", () => {
      nw.Shell.openExternal("https://twitter.com/evonia_network/");
    });
    let discord = document.querySelector("#discord.follow-link");
    discord.addEventListener("click", () => {
      nw.Shell.openExternal("https://discord.gg/xd5VuMRduy");
    });
    let youtube = document.querySelector("#youtube.follow-link");
    youtube.addEventListener("click", () => {
      nw.Shell.openExternal("https://www.youtube.com/channel/UC3uSViy-aWBAk6b36Xjnm0g");
    });

    /* terms */

    let ToU = document.querySelector("#ToU");
    ToU.addEventListener("click", () => {
      nw.Shell.openExternal("https://evoniamc.eu/cgu");
    });

    let Copy = document.querySelector("#Copy");
    ToU.addEventListener("click", () => {
      nw.Shell.openExternal("https://devmetrics.shop");
    });
  }
}

function sleep(ms){
  return new Promise((r) => { setTimeout(r, ms) });
}

export default Home;
