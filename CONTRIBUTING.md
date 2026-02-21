# Contributing

We do our best to recognize several ways one can contribute to this project.

- [Become a translation contributor](/#Become%20a%20translation%20contributor), from English to your native language.
- [Become a design contributor](/#Become%20a%20design%20contributor) by researching, prototyping, and drawing new interfaces and user experiences.
- [Become a documentation contributor](/#Become%20a%20documentation%20contributor), using primarily English skills and user knowledge of OSE to expand or find errors in our documentation.
- **[Become a code contributor](/#Become%20a%20code%20contributor), using basic or intermediate knowledge of JavaScript to improve how the game system functions.**

This guide will go over each.

## Project values

- Always answer contributors' questions and troubleshoot any obstacles to contributing.
- Treating your contributions with respect because we respect the time you've devoted to them, and expecting the same respect for our reviewers' time. Always communicating with this respect in mind.
- Generally, we seek "lazy consensus" and to some extent apply "meritocracy" as a principle for democratic decision-making. We have often looked for opinions from the contributor community, and if no one voices their dissenting opinion for a particular course of action, it will be taken as approval. Those who have volunteered the most time into the project will often get more consideration, which is a practical approach to consensus-building without disrupting forward momentum on the project. We ask for those who want to overwrite others' work with something "better" to make proposals before devoting their time on the change. This shows that you respect the consensus-building process.

We don't always have the time and resources to help everyone personally, so we will often ask you to check existing documentation. If your problem is not addressed there, it's an opportunity to [open a new issue][new issue] to improve the documentation.

## Become a translation contributor

The OSE system uses a [Crowdin project][crowdin project] to collect translation contributions. A free Crowdin account is required. You will be able to sign up for the "OSE" project on your own and immediately start contributing.

### Adding new translation strings

Crowdin provides [detailed instructions][crowdin docs for translators] for new translators on their website.

### Requesting a language that is not listed

By default, only the top 30 languages by number of speakers are listed in Crowdin. If you want to contribute translations for a new language, first make sure that Foundry VTT already has a ["core" translation module][core translation] for that language, otherwise you won't be able to use OSE translations in that language. Then contact the Crowdin project administrator, who will notify you when the new language is added to the project.

## Become a design contributor

Design contributions help improve the visual appearance and user experience of the OSE system. We welcome contributions from designers with various skill sets.

### Contributing user experience designs

User experience (UX) designers help improve how gamemasters and players interact with the system. UX contributions might include:

- Analyzing and documenting user workflows
- Identifying pain points in common tasks (character creation, inventory management, combat tracking)
- Proposing improved information architecture
- Creating wireframes or mockups for new features
- Conducting usability testing and documenting findings
- Improving accessibility for users with disabilities

To contribute UX designs, please open a GitHub discussion describing the problem you've identified and your proposed solution. Include mockups, user flows, or other documentation that helps explain your design.

### Contributing graphical interface designs

Graphical interface (UI) designers help make the OSE system visually appealing and consistent. UI contributions might include:

- Designing icons for items, abilities, or UI elements
- Creating character sheet layouts and styling
- Improving typography and color schemes
- Designing dialog boxes and modal windows
- Creating themed variants (light/dark modes, alternate aesthetics)
- Improving visual hierarchy and information density

For UI contributions, please open a GitHub discussion with visual examples (screenshots, mockups, or design files). We appreciate designs that respect the Old-School Essentials aesthetic while maintaining good usability.

## Become a documentation contributor

We have a double-pronged documentation approach:

1. User help, provided to gamemasters and players who need an extra push into getting started or finding their way around the OSE game system.
1. Contributor help, provided to contributors of the game system (especially new contributors) who often need guidance on how to successfully contribute to the project as a whole.

In each of these cases, there are multiple needs being served:

- Gamemaster or player who wants to be guided inside of Foundry itself (with the help of the Tours system)
- Gamemaster or player who wants to read or reference a document to find out if/how to do something (such as a user docs webpage)
- Code author who needs to remember what a specific function or code file does (in-line comments, docs webpage)
- Other type of contributor who needs guidance on contribution steps or third-party webapps they need to use (markdown files inside the project, contributor docs webpage)

## Become a code contributor

This guide should help you get the development environment running.

### Developer Environment Installation

Prerequisites: Node.js (v20 or greater is recommended), a familiarity with Foundry VTT with a valid license

[Node installers (beginner-friendly)](https://nodejs.org/en/download/)
[Node on package managers (recommended)](https://nodejs.org/en/download/package-manager/)

1. With Node.js installed, verify npm is available by running `npm -v` in your preferred command line interface.
1. (Star) and fork this repo.
1. Clone your fork to a directory suitable for containing your code projects, such as `/yourusername/Github/`. It will create the `ose-foundry-core` directory. In the command line, your command should look like `git clone git@github.com:yourusername/ose-foundry-core.git`.
1. Open `ose-foundry-core` in an IDE and/or your Terminal and install dependencies. In the command line, `cd ose-foundry-core && npm i`.
1. Copy the `foundryconfig.json.example` file to your repo's root directory, and rename it `foundryconfig.json`

   `/foundryconfig.json`

   ```json
   {
     "dataPath": [
       "path/to/FoundryVTT-userdata REPLACE THIS STRING",
       "path/to/FoundryVTT-userdata-if-you-have-multiple OTHERWISE USE ONLY ONE STRING"
     ],
     "symLinkName": "ose-dev"
   }
   ```

1. In your command line, run `npm run link`. A new system should now appear in your systems directory (or directories) but it doesn't yet run any code.
1. In your command line, run `npm run build` (build once) or `npm run watch` (build continuously, whenever a change is saved). You now have a working copy of OSE's developer build. You should be able to install releases of `Old-School Essentials` alongside this build.

### Addendum: Git for Beginners

Many contributors to OSE on Foundry VTT are inexperienced with git. GitHub provides their [quickstart tutorial](https://docs.github.com/en/get-started/quickstart/hello-world) which we recommend as a first step toward becoming an OSE Contributor.

Here are some next steps to get started on your first code contribution.

1. Create a new branch for your patch. In your command line, `git checkout -b a-branchname-of-your-choosing`
1. Make any code contributions you'd like, making sure to confirm it performs the behavior you want after trying it in Foundry VTT, and testing for edge cases if relevant.
1. When you are satisfied, push the branch to your GitHub fork. In your command link, `git push origin a-branchname-of-your-choosing`.
1. Follow GitHub's instructions for creating a pull request from their website.

## Troubleshooting

To ask for a hand to help onboard you before making your first contribution to this repo, I recommend joining our [OSE on Foundry VTT Discord server](https://discord.gg/qGrxRK2yD5).

### Errors from `node gyp` when running `npm i` on Windows.

[Follow these directions](https://github.com/nodejs/node-gyp#on-windows), then run `npm i` again. If you still have issues after trying to follow Microsoft's Node.js guidelines, chat with us on Discord.

### Error: `Operation not permitted` when trying to run `npm run link`

On Windows you may have to run your shell/command prompt in administrator mode to create a symlink. This should be rare in Linux, but `sudo npm run link` or changing the owner of the Foundry user data directory to the current user should make this command run without errors.

### Error: Cannot find module 'rollup'

You may need to verify npm is installed by running `npm -v`. If npm is not available, try reinstalling Node.js and run `npm i` again.

### Error: Cannot find module (any module except rollup)

You will need to `npm i` occasionally as we put out updates to the build process.

## Addendum: Multiple Builds of OSE in the same Foundry VTT installation

The maintainer of this repository has three versions of OSE installed in any given version of Foundry VTT. And 2 or 3 versions of Foundry VTT installed at any given time. Their home directory looks something like this.

```console
~/
    mygithubusername/
        ose-foundry-core/
    NecroticGnome/
        ose-foundry-core/
    fvtt/
        v13/
        v13-userdata/Data/
            systems/
                ose/
                ose-dev/
                ose-test/
        v14/
        v14-userdata/Data/
            systems/
                ose/
                ose-dev/
                ose-test/
```

This is achieved with `foundryconfig.json` files in each local version of the github repo on the maintainer's computer. Because of an npm script, each repo can make two symlinks, one for Foundry v12 and one for Foundry v13.

`~/mygithubusername/ose/foundryconfig.json`

```json
{
  "dataPath": ["~/fvtt/v13-userdata", "~/fvtt/v14-userdata"],
  "symlinkName": "ose-dev"
}
```

`~/NecroticGnome/ose-foundry-core/foundryconfig.json`

```json
{
  "dataPath": ["~/fvtt/v13-userdata", "~/fvtt/v14-userdata"],
  "symlinkName": "ose-test"
}
```

If you want to have two local versions of your repository, there will be an additional build step. Run `git config --local include.path ../.gitconfig` in each of your repositories' root directories. Then make sure they have different symlinkNames in the `foundryconfig.json` files for each repo. Run `npm run link` in each repository.

Note: you will have to provide your own .gitconfig for Windows

[new issue]: https://github.com/NecroticGnome/ose-foundry-core/issues/new
[core translation]: https://foundryvtt.com/packages/tag/translation
[crowdin project]: https://crowdin.com/project/ose
[crowdin docs for translators]: https://support.crowdin.com/enterprise/getting-started-for-translators/
