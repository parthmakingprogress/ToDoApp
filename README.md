# Today / To Do

A small to-do app that runs on your machine. Tasks are saved by the local server in `data/tasks.json` and are still there when you restart it.

## Run it

Requires Node.js 18 or newer. From this folder, run:

```sh
npm start
```

Then open [http://localhost:3000](http://localhost:3000). Set the `PORT` environment variable to use a different port.

The server stores task titles, completion status, and creation times in `data/tasks.json`. Keep that file to preserve your tasks; deleting it resets the list.