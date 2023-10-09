import { moorhen } from "../types/moorhen"
import { webGL } from "../types/mgWebGL";

interface MoorhenScriptApiInterface {
    molecules: moorhen.Molecule[];
    maps: moorhen.Map[];
    glRef: React.RefObject<webGL.MGWebGL>;
    commandCentre: React.RefObject<moorhen.CommandCentre>;
}

export class MoorhenScriptApi implements MoorhenScriptApiInterface {

    molecules: moorhen.Molecule[];
    maps: moorhen.Map[];
    glRef: React.RefObject<webGL.MGWebGL>;
    commandCentre: React.RefObject<moorhen.CommandCentre>;

    constructor(commandCentre: React.RefObject<moorhen.CommandCentre>, glRef: React.RefObject<webGL.MGWebGL>, molecules: moorhen.Molecule[], maps: moorhen.Map[]) {
        this.molecules = molecules
        this.maps = maps
        this.glRef = glRef
        this.commandCentre = commandCentre
    }

    doRigidBodyFit = async (molNo: number, cidsString: string, mapNo: number) => {
        const selectedMolecule = this.molecules.find(molecule => molecule.molNo === molNo)
        if (typeof selectedMolecule !== 'undefined') {
            await selectedMolecule.rigidBodyFit(cidsString, mapNo)
            selectedMolecule.setAtomsDirty(true)
            await selectedMolecule.redraw()
        } else {
            console.log(`Unable to find molecule number ${molNo}`)
        }
    }

    doGenerateSelfRestraints = async (molNo: number, maxRadius: number) => {
        const selectedMolecule = this.molecules.find(molecule => molecule.molNo === molNo)
        if (typeof selectedMolecule !== 'undefined') {
            await selectedMolecule.generateSelfRestraints("//", maxRadius)
        } else {
            console.log(`Unable to find molecule number ${molNo}`)
        }
    }

    doRefineResiduesUsingAtomCid = async (molNo: number, cid: string, mode: string, ncyc: number) => {
        const selectedMolecule = this.molecules.find(molecule => molecule.molNo === molNo)
        if (typeof selectedMolecule !== 'undefined') {
            await selectedMolecule.refineResiduesUsingAtomCid(cid, mode, ncyc)
            selectedMolecule.setAtomsDirty(true)
            await selectedMolecule.redraw()
        } else {
            console.log(`Unable to find molecule number ${molNo}`)
        }
    }

    doClearExtraRestraints = async (molNo: number) => {
        const selectedMolecule = this.molecules.find(molecule => molecule.molNo === molNo)
        if (typeof selectedMolecule !== 'undefined') {
            await selectedMolecule.clearExtraRestraints()
        } else {
            console.log(`Unable to find molecule number ${molNo}`)
        }
    }

    setGemanMcclureAlpha = async (newValue: number) => {
        await this.commandCentre.current.cootCommand({
            returnType: "status",
            command: 'set_refinement_geman_mcclure_alpha',
            commandArgs: [newValue],
            changesMolecules: []
          }, true)
    }

    exe(src: string) {
        // This env defines the variables accesible within the user-defined code
        let env = {
            molecules: this.molecules.reduce((obj, molecule) => {
                obj[molecule.molNo] = molecule
                return obj
            }, {}),
            maps: this.maps.reduce((obj, map) => {
                obj[map.molNo] = map
                return obj
            }, {}),
            glRef: this.glRef,
            rigid_body_fit: this.doRigidBodyFit,
            generate_self_restraints: this.doGenerateSelfRestraints,
            clear_extra_restraints: this.doClearExtraRestraints,
            refine_residues_using_atom_cid: this.doRefineResiduesUsingAtomCid,
            set_refinement_geman_mcclure_alpha: this.setGemanMcclureAlpha
        };

        (new Function("with(this) { " + src + "}")).call(env)
    }
}