//捕获率and稀有度patch

exports.PetModeRoomConfig = {
	'skypillar': {
		//因为老超一直碰不到Caterpie所以给老超respect
		//因为和海星没在同一频道所以这个要交给他重新format
		//'lawn': {"Caterpie":0.78,"Caterpie":0.78,"Caterpie":0.78,"Caterpie":0.78,"Caterpie":0.78,"Caterpie":0.78,"Weedle":0.81,"Weedle":0.81,"Weedle":0.81,"Ledyba":0.89,"Ledyba":0.89,"Spinarak":0.63,"Spinarak":0.63,"Spinarak":0.63,"Wurmple":0.75,"Wurmple":0.75,"Kricketot":0.59,"Sewaddle":0.84,"Sewaddle":0.84,"Sewaddle":0.84,'"Venipede":0.70,"Venipede":0.70,"Scatterbug":0.84,"Scatterbug":0.84,"Grubbin":0.75,"Grubbin":0.75,"Blipbug":0.72,"Blipbug":0.72,"Poochyena":0.68,"Poochyena":0.68,"Poochyena":0.68,"Poochyena":0.68,"Poochyena":0.68,"Poochyena":0.68,"Poochyena":0.68,"Shinx":0.55,"Shinx":0.55,"Shinx":0.55,"Lillipup":0.76,"Lillipup":0.76,"Lillipup":0.76,"Lillipup":0.76,"Purrloin":0.56,"Purrloin":0.56,"Nickit"0.69,"Pidgey":0.76,"Pidgey":0.76,"Pidgey":0.76,"Pidgey":0.76,"Pidgey":0.76,"Pidgey":0.76,"Hoothoot":0.80,"Hoothoot":0.80,"Hoothoot":0.80,"Hoothoot":0.80,"Taillow":0.12,"Starly":0.34,"Starly":0.34,"Pidove":0.66,"Pidove":0.66,"Pidove":0.66,"Fletchling":0.62,"Fletchling":0.62,"Pikipek":0.74,"Rookidee":0.65,"Rattata":0.82,"Rattata":0.82,"Rattata":0.82,"Rattata":0.82,"Rattata":0.82,"Rattata":0.82,"Rattata":0.82,"Rattata":0.03,"Sentret":0.89,"Sentret":0.89,"Sentret":0.89,"Sentret":0.89,"Zigzagoon":0.74,"Zigzagoon":0.74,"Zigzagoon":0.74,"Bidoof":0.88,"Bidoof":0.88,"Bidoof":0.88,"Patrat":0.87,"Patrat":0.87,"Patrat":0.87,"Bunnelby":0.41,"Yungoos":0.76,"Yungoos":0.76, "Skwovet":0.84},
		'lawn': ['Caterpie','Weedle','Ledyba','Spinarak','Wurmple','Kricketot','Sewaddle','Venipede','Scatterbug','Grubbin','Blipbug','Poochyena','Shinx','Lillipup','Purrloin','Nickit','Pidgey','Hoothoot','Taillow','Starly','Pidove','Fletchling','Pikipek','Rookidee','Rattata','Sentret','Zigzagoon','Bidoof','Patrat','Bunnelby','Yungoos', 'Skwovet'],
		'minlevel': 2,
		'maxlevel': 5,
	},
	'flowerparadise': {
		'lawn': ['Rattata','Oddish','Paras','Mankey','Poliwag','Nidoran-M','Nidoran-F','Magikarp','Azurill','Hoppip','Aipom','Sunkern','Dunsparce','Lotad','Seedot','Wingull','Ralts','Surskit','Shroomish','Slakoth','Nincada','Whismur','Cherubi','Pansage','Pansear','Panpour','Flabébé','Skiddo','Espurr','Spritzee','Swirlix','Mudbray','Dewpider','Fomantis','Morelull','Gossifleur','Wooloo','Milcery'],
		'minlevel': 5,
		'maxlevel': 10,
	},
	'lc': {
		'lawn': ['Spearow','Ekans','Sandshrew','Sandshrew-Alola','Cleffa','Igglybuff','Zubat','Bellsprout','Geodude','Onix','Krabby','Mareep','Murkrow','Snubbull','Shuckle','Delibird','Tyrogue','Makuhita','Nosepass','Aron','Budew','Gulpin','Spoink','Spheal','Burmy','Combee','Pachirisu','Finneon','Munna','Cottonee','Petilil','Mienfoo','Litleo','Dedenne','Crabrawler','Rockruff','Stufful','Bounsweet','Wimpod','Sandygast','Chewtle','Yamper','Rolycoly'],
		'minlevel': 11,
		'maxlevel': 15,
	},
	'neverused': {
		'lawn': ['Venonat','Meowth','Meowth-Alola','Psyduck','Abra','Machop','Tentacool','Slowpoke','Magnemite',"Farfetch'd",'Voltorb','Elekid','Wooper','Slugma','Corsola','Remoraid','Houndour','Skitty','Plusle','Minun','Barboach','Chingling','Buizel','Glameow','Stunky','Chatot','Carnivine','Snover','Blitzle','Tympole','Dwebble','Ducklett','Emolga','Karrablast','Shelmet','Rufflet','Clauncher','Helioptile','Comfey','Oranguru','Silicobra','Cramorant','Clobbopus','Zigzagoon-Galar'],
		'minlevel': 16,
		'maxlevel': 20,
	},
	'rarelyused': {
		'lawn': ['Pichu','Vulpix','Diglett','Diglett-Alola','Growlithe','Gastly','Drowzee','Cubone','Eevee','Chinchou','Natu','Yanma','Misdreavus','Pineco','Teddiursa','Phanpy','Electrike','Volbeat','Illumise','Wailmer','Numel','Spinda','Cacnea','Baltoy','Shuppet','Duskull','Clamperl','Relicanth','Luvdisc','Drifloon','Skorupi','Roggenrola','Woobat','Timburr','Scraggy','Yamask','Yamask-Galar','Inkay','Skrelp','Phantump','Pumpkaboo','Salandit','Passimian','Dhelmise','Sizzlipede','Meowth-Galar','Ponyta-Galar','Pincurchin','Cufant'],
		'minlevel': 21,
		'maxlevel': 25,
	},
	'underused': {
		'lawn': ['Ponyta','Rapidash','Doduo','Dodrio','Lickitung','Horsea','Goldeen','Magby','Tauros','Swinub','Mantyke','Smoochum','Carvanha','Trapinch','Swablu','Zangoose','Seviper','Lunatone','Solrock','Corphish','Kecleon','Absol','Shellos','Hippopotas','Sandile','Sigilyph','Deerling','Cubchoo','Cryogonal','Pancham','Furfrou','Binacle','Oricorio',"Oricorio-Pa'u" ,"Oricorio-Pom-Pom"  ,"Oricorio-Sensu",'Cutiefly','Togedemaru','Toxel','Sinistea','Hatenna','Falinks','Snom','Stonjourner','Eiscue','Indeedee','Morpeko'],
		'minlevel': 26,
		'maxlevel': 30,
	},
	'oldgens': {
		'lawn': ['Exeggcute','Exeggutor','Seel','Dewgong','Koffing','Tangela','Girafarig','Qwilfish','Sneasel','Stantler','Meditite','Torkoal','Tropius','Snorunt','Bronzor','Croagunk','Throh','Sawk','Basculin','Darumaka','Maractus','Minccino','Vanillite','Joltik','Klink','Tynamo','Elgyem','Litwick','Stunfisk','Golett','Bouffalant','Heatmor','Durant','Amaura','Tirtouga','Trubbish','Garbodor','Grimer','Muk','Minior','Komala','Bruxish'],
		'minlevel': 31,
		'maxlevel': 35,
	},
	'ubers': {
		'lawn': ['Shellder','Cloyster','Rhyhorn','Staryu','Miltank','Spiritomb','Audino','Solosis','Duosion','Foongus','Frillish','Ferroseed','Axew','Druddigon','Tyrunt','Klefki','Bergmite','Noibat','Wishiwashi','Mareanie','Turtonator','Drampa','Applin','Impidimp','Morgrem','Duraludon'],
		'minlevel': 36,
		'maxlevel': 40,
	},
	'overused': {
		'lawn': ['Heracross','Skarmory','Sableye','Mawile','Buneary','Drilbur','Excadrill','Gothita','Gothorita','Gothitelle','Alomomola','Pawniard','Vullaby','Larvesta','Honedge','Doublade','Hawlucha','Gligar','Pyukumuku','Mimikyu','Arrokuda','Barraskewda','Scyther','Pinsir'],
		'minlevel': 41,
		'maxlevel': 50,
	},
	'nationaldex': {
		'lawn': ['Happiny','Chansey','Kangaskhan','Mime Jr.','Mr. Mime','Lapras','Munchlax','Snorlax','Bonsly','Sudowoodo','Riolu','Lucario','Rotom','Mr. Mime-Galar','Corsola-Galar','Darumaka-Galar','Slowpoke-Galar','Stunfisk-Galar',"Farfetch'd-Galar",'Vulpix-Alola'],
		'minlevel': 51,
		'maxlevel': 100,
	},
	/*'wcs': {
		'lawn': ['Porygon','Omanyte','Kabuto','Aerodactyl','Ditto','Dratini','Togepi','Unown','Wynaut','Smeargle','Larvitar','Lileep','Anorith','Feebas','Castform','Bagon','Beldum','Gible','Archen','Cranidos','Shieldon','Zorua','Deino','Goomy','Carbink','Type: Null','Jangmo-o','Dracozolt','Arctozolt','Dracovish','Arctovish','Dreepy'],
		'minlevel': 100,
		'maxlevel': 100,
	}*/
}
