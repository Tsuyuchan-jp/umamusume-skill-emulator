const fs = require('fs');
let content = fs.readFileSync('build_dump.js', 'utf8');
content = content.replace('instance.progressRace();', `
  if (tc.name === "Kyoto 3200m Oikomi") {
    const origProgress = instance.progressRace;
    instance.progressRace = function() {
      const maxEpoch = Math.ceil(this.courseLength * 15 * 1.5);
      for(let i=0; i<maxEpoch; i++) {
        if (this.position >= this.courseLength) break;
        this.progressEpoch();
        if (i >= 265 && i <= 275) {
           console.log('Frame ' + i + ': targetSpeed = ' + this.targetSpeed + ', section = ' + this.currentSection + ', pos = ' + this.position);
        }
        this.progressSelfSpeed();
        this.progressPosition();
        let consume = this.consumePerSecond(this.isStartDash ? this.currentSpeed : this.baseSpeed, this.currentSpeed, this.currentPhase) / 15.0;
        this.sp -= consume;
        this.frameElapsed++;
        if (this.currentPhase == 1 && this.getPhase() == 2) {
          this.spurtParameters = this.calcSpurtParameter(false);
        }
      }
    };
  }
  instance.progressRace();
`);
fs.writeFileSync('build_dump_mod.js', content);
