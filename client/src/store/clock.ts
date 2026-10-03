import { observable, runInAction } from 'mobx';

export const clock = observable({ now: Date.now() });

setInterval(() => runInAction(() => { clock.now = Date.now(); }), 5_000);
