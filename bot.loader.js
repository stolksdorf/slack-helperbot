const _ = require('lodash');
const console = require('./logbot.js');
let Bots = [];



module.exports = function(Slack, botInfo){

	const mapTarget = (target) => {
		const channelId = _.findKey(Slack.channels, (channel)=>{
			return channel == target;
		});
		if(channelId) return channelId;
		return _.findKey(Slack.dms, (user)=>{
			return user == target;
		});
	};


	const getBotContext = (bot, msg)=>{
		const context = {
			reply : (text, target) => {
				let _target = msg.channelId;

				if(target){
					_target = mapTarget(target);
					if(!_target){
						console.error(`Can't find target named: ${target}`);
						return Promise.reject();
					}
				}
				return context.api('chat.postMessage', {
					channel : _target,
					text : text,
				});
			},
			react: (emoji) => {
				return context.api('reactions.add', {
					channel : msg.channelId,
					name : emoji,
					timestamp : msg.ts
				});
			},
			api : (cmd, payload) => {
				return Slack.api(cmd, _.assign({
						username   : bot.name || botInfo.name,
						icon_emoji : bot.icon || botInfo.icon
					}, payload))
					.catch(console.error);
			}
		}

		return context;
	};



	return {
		load : function(bots){
			_.each(bots, (bot) => {
				if(!bot.channel){
					console.warn(`No channel set for '${bot.name}'. Set it to * if you want to listen to all.`);
				}else{
					Bots.push(bot);
				}
			})
		},

		handleMessage : function(msg){
			_.each(Bots, (bot)=>{
				if(bot.channel !== '*' && bot.channel !== msg.channel) return;

				const context = getBotContext(bot, msg)
				const errHandler = (err) => {
					console.error(err, 'Bot Run Error : ' + bot.file);
					context.reply('Oops, looks like I broke. Check out #diagnostics for details.');
				};
				const d = require('domain').create();
				d.on('error', errHandler);
				d.run(()=>{
					try{
						bot.handle(msg.text, msg, context);
					}catch(err){
						errHandler(err);
					}
				});
			});
		}

	}
}