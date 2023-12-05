import { useState } from "react";
import { MenuItem } from "@mui/material";
import { MoorhenCopyFragmentUsingCidMenuItem } from "../menu-item/MoorhenCopyFragmentUsingCidMenuItem";
import { MoorhenDeleteUsingCidMenuItem } from "../menu-item/MoorhenDeleteUsingCidMenuItem"
import { MoorhenGoToMenuItem } from "../menu-item/MoorhenGoToMenuItem"
import { MoorhenMergeMoleculesMenuItem } from "../menu-item/MoorhenMergeMoleculesMenuItem"
import { MoorhenAddSimpleMenuItem } from "../menu-item/MoorhenAddSimpleMenuItem";
import { MoorhenAddRemoveHydrogenAtomsMenuItem } from "../menu-item/MoorhenAddRemoveHydrogenAtomsMenuItem"
import { MoorhenMoveMoleculeHere } from "../menu-item/MoorhenMoveMoleculeHere"
import { MoorhenNavBarExtendedControlsInterface } from "./MoorhenNavBar";
import { moorhen } from "../../types/moorhen";
import { useDispatch, useSelector } from "react-redux";
import { setShowCreateAcedrgLinkModal } from "../../store/activeModalsSlice";

export const MoorhenEditMenu = (props: MoorhenNavBarExtendedControlsInterface) => {
    const dispatch = useDispatch()
    const devMode = useSelector((state: moorhen.State) => state.generalStates.devMode)

    const [popoverIsShown, setPopoverIsShown] = useState(false)

    const menuItemProps = { setPopoverIsShown, ...props }
    
    return <>
            <MoorhenAddSimpleMenuItem key="add_simple" setPopoverIsShown={() => {}} {...menuItemProps} />
            <MoorhenAddRemoveHydrogenAtomsMenuItem key='add_remove_hydrogens' {...menuItemProps}/>
            <MoorhenMergeMoleculesMenuItem key="merge" {...menuItemProps} />
            <MoorhenMoveMoleculeHere key="move" {...menuItemProps}/>
            <MoorhenDeleteUsingCidMenuItem key="delete" {...menuItemProps} />
            <MoorhenCopyFragmentUsingCidMenuItem key="copy_fragment" {...menuItemProps} />
            <MoorhenGoToMenuItem key="go_to_cid" {...menuItemProps} />
            {devMode &&
                <MenuItem onClick={() => {
                    dispatch(setShowCreateAcedrgLinkModal(true))
                    document.body.click()
                }}>
                    Create covalent link between two atoms...
                </MenuItem>            
            }
            {props.extraEditMenuItems && props.extraEditMenuItems.map( menu => menu)}
    </>
}