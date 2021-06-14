import {FS} from '../../../lib';
import {Teams} from '../../../sim/teams'
import {RandomTeams} from '../../random-teams';

const USERPATH = 'config/pet-mode/user-properties';

export class RandomPSChinaPetModeTeams extends RandomTeams {

	randomPetModeTeam(options: PlayerOptions) {
		const userPropertyString = FS(`${USERPATH}/${Dex.toID(options.name)}.json`).readIfExistsSync();
		if (userPropertyString) {
			let userDefaultTeam = JSON.parse(userPropertyString)['bag'].filter((x: string) => x);
			if (userDefaultTeam.length > 0) {
				return Teams.unpack(userDefaultTeam.join(']'));
			}
		}
		return Teams.unpack('Magikarp|||SwiftSwim|Splash|Hardy||M|0,0,0,0,0,0||5|');
	}

}

export default RandomPSChinaPetModeTeams;