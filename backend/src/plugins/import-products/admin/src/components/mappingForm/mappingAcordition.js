import React, { memo, useContext, useEffect, useState } from 'react';
// import PropTypes from 'prop-types';
import pluginId from '../../pluginId';

import { Accordion, AccordionToggle, AccordionContent, AccordionGroup } from '@strapi/design-system/Accordion';
import Plus from '@strapi/icons/Plus';
import Trash from '@strapi/icons/Trash';
import { Box } from '@strapi/design-system/Box';
import { TextButton } from '@strapi/design-system/TextButton';
import { Grid, GridItem } from '@strapi/design-system/Grid';
import { Flex } from '@strapi/design-system/Flex';
import { Stack } from '@strapi/design-system/Stack';
import { Tooltip } from '@strapi/design-system/Tooltip';
import { IconButton } from '@strapi/design-system/IconButton';
import { TextInput } from '@strapi/design-system/TextInput';
import Information from '@strapi/icons/Information';
import MappingForm from './index'
import { MappingContext } from '../../pages/Mapping/mappingcontext';

const MappingContainAccordion = ({ catContain, label, categoryID }) => {
    const [importMapping, setImportMapping] = useContext(MappingContext)
    const [expandedContains, setExpandedContains] = useState(false);
    const [name, setName] = useState(catContain.name);
    const [value, setValue] = useState(catContain.value);
    const [id, setId] = useState();

    useEffect(() => {
        updateMapping(id)
    }, [name, value])

    const handleDeleteContain = (id) => {

        let new_map = []
        switch (label) {
            case "Κατηγορία":
                new_map = importMapping.categories_map.map(item => {
                    item.contains = item.contains.filter(subItem => subItem.id !== id)
                    return item
                })
                break;
            case "Υποκατηγορία":
                new_map = importMapping.categories_map.map(item => {
                    item.subcategory.map(subItem => {
                        subItem.contains = subItem.contains.filter(subItem2 => subItem2.id !== id)
                        return subItem
                    })
                    return item
                })
                break;
            case "Υποκατηγορία2":
                new_map = importMapping.categories_map.map(item => {
                    item.subcategory.map(subItem => {
                        subItem.subcategory.map(subItem2 => {
                            subItem2.contains = subItem2.contains.filter(subItem3 => subItem3.id !== id)
                            return subItem2
                        })
                        return subItem
                    })
                    return item
                })
                break;
            default:
                break;
        }

        setImportMapping({ ...importMapping, categories_map: new_map })
    }

    const handleOnChangeName = (e, contid) => {
        setName(e.target.value)
        setId(contid)
    }

    const handleOnChangeValue = (e, contid) => {
        setValue(e.target.value)
        setId(contid)
    }

    const updateMapping = (id) => {
        let new_map = []
        switch (label) {
            case "Κατηγορία":
                new_map = importMapping.categories_map.map(item => {
                    item.contains.map(subItem => {
                        if (subItem.id === id) {
                            subItem.name = name,
                                subItem.value = value
                        }
                        return subItem
                    })
                    return item
                })
                break;
            case "Υποκατηγορία":
                new_map = importMapping.categories_map.map(item => {
                    item.subcategory.map(subItem => {
                        subItem.contains.map(subItem2 => {
                            if (subItem2.id === id) {
                                subItem2.name = name,
                                    subItem2.value = value
                            }
                            return subItem2
                        })
                        return subItem
                    })
                    return item
                })
                break;
            case "Υποκατηγορία2":
                new_map = importMapping.categories_map.map(item => {
                    item.subcategory.map(subItem => {
                        subItem.subcategory.map(subItem2 => {
                            subItem2.contains.map(subItem3 => {
                                if (subItem3.id === id) {
                                    subItem3.name = name,
                                        subItem3.value = value
                                }
                                return subItem3
                            })
                            return subItem2
                        })
                        return subItem
                    })
                    return item
                })
                break;
            default:
                break;
        }

        setImportMapping({ ...importMapping, categories_map: new_map })
    }

    return (
        <Accordion error="" expanded={expandedContains} onToggle={() => setExpandedContains(s => !s)} size="S">
            <AccordionToggle
                action={<IconButton noBorder onClick={() => handleDeleteContain(catContain.id)} label="Delete" icon={<Trash />} />}
                title={name}
                togglePosition="left" />
            <AccordionContent>
                <Stack horizontal padding={6} spacing={6}>
                    <TextInput
                        spacing={4}
                        name={name}
                        value={name}
                        label="Φράση στο αρχείο"
                        onChange={(e) => handleOnChangeName(e, catContain.id)}
                    />
                    <TextInput
                        name={value}
                        value={value}
                        label="Μετάφραση σε κατηγορία"
                        onChange={(e) => handleOnChangeValue(e, catContain.id)}
                    />
                </Stack>
            </AccordionContent>
        </Accordion>
    )
}

const MappingAccordion = ({ cat, label, categoryID }) => {

    const [importMapping, setImportMapping] = useContext(MappingContext)
    const [expanded, setExpanded] = useState(false);
    const [name, setName] = useState(cat.name);
    const [value, setValue] = useState(cat.value);
    const [tempId, setTempId] = useState(1);
    const [id, setId] = useState();

    useEffect(() => {
        updateCategoryMapping(id)
    }, [name, value])

    const handleContainsClick = () => {
        let findContain = []
        switch (label) {
            case "Κατηγορία":
                findContain = importMapping.categories_map.map(item => {
                    if (item.id === categoryID) {
                        item.contains = [...item.contains, { id: `contId-${categoryID}-${tempId}`, name: "", value: "" }]
                    }
                    return item
                })

                break;
            case "Υποκατηγορία":
                findContain = importMapping.categories_map.map(item => {
                    item.subcategory.map(subItem => {
                        if (subItem.id === categoryID) {
                            subItem.contains = [...subItem.contains, { id: `contId-${categoryID}-${tempId}`, name: "", value: "" }]
                        }
                    })
                    return item
                })
                break;
            case "Υποκατηγορία2":
                findContain = importMapping.categories_map.map(item => {
                    item.subcategory.map(subItem => {
                        subItem.subcategory.map(subItem2 => {
                            if (subItem2.id === categoryID) {
                                subItem2.contains = [...subItem2.contains, { id: `contId-${categoryID}-${tempId}`, name: "", value: "" }]
                            }
                        })
                    })
                    return item
                })

                break;
            default:
                break;
        }

        setTempId(tempId + 1)
    }

    const handleDeleteCategoryClick = (id) => {
        let new_map = []
        switch (label) {
            case "Κατηγορία":
                new_map = importMapping.categories_map.filter(item => item.id !== id)
                break;
            case "Υποκατηγορία":
                new_map = importMapping.categories_map.map(item => {
                    item.subcategory = item.subcategory.filter(subItem => subItem.id !== id)
                    return item
                })
                break;
            case "Υποκατηγορία2":
                new_map = importMapping.categories_map.map(item => {
                    item.subcategory = item.subcategory.map(subItem => {
                        subItem.subcategory = subItem.subcategory.filter(subItem2 => subItem2.id !== id)
                        return subItem
                    })
                    return item
                })
                break;
            default:
                break;
        }

       setImportMapping({ ...importMapping, categories_map: new_map })
    }

    const handleOnChangeCategoryName = (e, upID) => {
        setName(e.target.value)
        setId(upID)
    }

    const handleOnChangeCategoryValue = (e, upID) => {
        setValue(e.target.value)
        setId(upID)
    }

    const updateCategoryMapping = (id) => {
        let new_map = []
        switch (label) {
            case "Κατηγορία":
                new_map = importMapping.categories_map.map(item => {
                    if (item.id === id) {
                        item.name = name,
                            item.value = value
                    }
                    return item
                })
                break;
            case "Υποκατηγορία":
                new_map = importMapping.categories_map.map(item => {
                    item.subcategory = item.subcategory.map(subItem => {
                        if (subItem.id === id) {
                            subItem.name = name,
                                subItem.value = value
                        }
                        return subItem
                    })
                    return item
                })
                break;
            case "Υποκατηγορία2":
                new_map = importMapping.categories_map.map(item => {
                    item.subcategory = item.subcategory.map(subItem => {
                        subItem.subcategory = subItem.subcategory.map(subItem2 => {
                            if (subItem2.id === id) {
                                subItem2.name = name,
                                    subItem2.value = value
                            }
                            return subItem2
                        })
                        return subItem
                    })
                    return item
                })
                break;
            default:
                break;
        }

        setImportMapping({ ...importMapping, categories_map: new_map })
    }

    return (
        <Accordion error="" expanded={expanded} onToggle={() => setExpanded(!expanded)} id="acc-1" size="S">
            <AccordionToggle
                action={<IconButton noBorder onClick={() => handleDeleteCategoryClick(cat.id)} label="Delete" icon={<Trash />} />}
                title={name}
                togglePosition="left" />
            <AccordionContent>
                <Grid>
                    <GridItem col={6}>
                        <Stack horizontal padding={3} spacing={3}>
                            <TextInput
                                name={name}
                                value={name}
                                label="Όνομα κατηγορίας στο αρχείο"
                                onChange={(e) => handleOnChangeCategoryName(e, cat.id)}
                            />
                            <TextInput
                                name={value}
                                value={value}
                                label="Μετάφραση σε κατηγορία"
                                onChange={(e) => handleOnChangeCategoryValue(e, cat.id)} />
                        </Stack>
                    </GridItem>
                    <GridItem col={6}>
                        <Box padding={6}>
                            {cat.contains && <AccordionGroup error=""
                                footer={<Flex justifyContent="center" height="48px" background="neutral150">
                                    <TextButton startIcon={<Plus />} onClick={handleContainsClick}>
                                        Add an entry
                                    </TextButton>
                                </Flex>}
                                label="Φράση ή λέξη που περιέχει το όνομα"
                                labelAction={<Tooltip description="Xρησιμοποιήσε κάποιο χαρακτηριστικό του ονόματος του προϊόντος 
                                        σε συνδυασμό με την κατηγορία του προμηθευτή.Μπορείς να έχεις περισσότερες από μία επιλογές, 
                                        η κατηγορία θα αντιστοιχηθεί με το πρώτο χαρακτηριστικό που θα ταιριάζει!">
                                    <button aria-label="Information about the email"
                                        style={{
                                            border: 'none',
                                            padding: 0,
                                            background: 'transparent'
                                        }}><Information aria-hidden={true} />
                                    </button>
                                </Tooltip>}>
                                {cat.contains.map((catContain) => (
                                    <MappingContainAccordion
                                        key={catContain.id}
                                        label={label}
                                        catContain={catContain} />
                                ))}
                            </AccordionGroup>}
                        </Box>
                    </GridItem>
                </Grid>
                {cat.subcategory &&
                    <MappingForm label={label === "Υποκατηγορία" ? "Υποκατηγορία2" : "Υποκατηγορία"}
                        mapping={cat.subcategory}
                        categoryID={cat.id}
                    />}
            </AccordionContent>
        </Accordion>
    )
}

export default memo(MappingAccordion);